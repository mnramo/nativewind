import { createContext } from "react";
import {
  Dimensions,
  Appearance,
  ScaledSize,
  EmitterSubscription,
  NativeEventSubscription,
  TextStyle,
  ImageStyle,
  ViewStyle,
  Platform,
  StyleProp,
} from "react-native";
import {
  matchAtRule,
  matchChildAtRule,
  MatchChildAtRuleOptions,
} from "./match-at-rule";
import {
  createAtRuleSelector,
  createNormalizedSelector,
  CreateSelectorOptions,
} from "../shared/selector";
import { AtRuleTuple, MediaRecord } from "../types/common";
import vh from "./units/vh";
import vw from "./units/vw";
import { ColorSchemeStore, ColorSchemeSystem } from "./color-scheme";

export type { ColorSchemeSystem, ColorSchemeName } from "./color-scheme";
export type Style = ViewStyle | ImageStyle | TextStyle;
export type InlineStyle<T extends Style> = T;
export type AtRuleStyle<T extends Style> = T & { atRules: unknown[] };
export type CompiledStyle = { [key: string]: string } & { $$css: boolean };
export type EitherStyle<T extends Style = Style> =
  | AtRuleStyle<T>
  | CompiledStyle
  | InlineStyle<T>
  | StyleProp<T>;

export type Snapshot = Record<string, StylesArray>;

const emptyStyles: StylesArray = [];

export interface ChildStyle {
  className: string;
  style: Style;
  atRules: AtRuleTuple[];
}

export interface StylesArray<T = Style> extends Array<EitherStyle<T>> {
  dynamic?: boolean;
  isForChildren?: boolean;
  childStyles?: ChildStyle[];
  topics?: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var tailwindcss_react_native_style: Record<string, Style>;
  // eslint-disable-next-line no-var
  var tailwindcss_react_native_media: MediaRecord;
}

globalThis.tailwindcss_react_native_style ??= {};
globalThis.tailwindcss_react_native_media ??= {};

const units: Record<
  string,
  (value: string | number) => string | number | Record<string, unknown>
> = {
  vw,
  vh,
};

interface StyleSheetStoreConstructor {
  styles?: typeof global.tailwindcss_react_native_style;
  atRules?: typeof global.tailwindcss_react_native_media;
  dimensions?: Dimensions;
  appearance?: typeof Appearance;
  platform?: typeof Platform.OS;
  preprocessed?: boolean;
  colorScheme?: ColorSchemeSystem;
}

/**
 * Tailwind styles are strings of atomic classes. eg "a b" compiles to [a, b]
 *
 * If the styles are static we can simply cache them and return a stable result
 *
 * However, if the styles are dynamic (have atRules) there are two things we need to do
 *  - Update the atomic style
 *  - Update the dependencies of the atomic style
 *
 * This is performed by each style subscribing to a atRule topic. The atomic styles are updated
 * before the parent styles.
 *
 * The advantage of this system is that styles are only updated once, no matter how many components
 * are on using them
 *
 * The disadvantages are
 * - Is that the store doesn't purge unused styles, so the listeners will continue to grow
 * - UI states (hover/active/focus) are considered separate styles
 *
 * If you are interested in helping me build a more robust store, please create an issue on Github.
 *
 */
export class StyleSheetStore extends ColorSchemeStore {
  snapshot: Snapshot = { "": emptyStyles };
  listeners = new Set<() => void>();
  atRuleListeners = new Set<(topics: string[]) => void>();

  dimensionListener: EmitterSubscription;
  appearanceListener: NativeEventSubscription;

  styles: Record<string, Style>;
  atRules: MediaRecord;
  preprocessed: boolean;

  platform: typeof Platform.OS;
  window: ScaledSize;
  orientation: OrientationLockType;

  constructor({
    styles = global.tailwindcss_react_native_style,
    atRules = global.tailwindcss_react_native_media || [],
    dimensions = Dimensions,
    appearance = Appearance,
    platform = Platform.OS,
    preprocessed = false,
    colorScheme,
  }: StyleSheetStoreConstructor = {}) {
    super(colorScheme);

    this.platform = platform;
    this.styles = styles;
    this.atRules = atRules;
    this.preprocessed = preprocessed;
    this.window = dimensions.get("window");

    const screen = dimensions.get("screen");
    this.orientation = screen.height >= screen.width ? "portrait" : "landscape";

    this.dimensionListener = dimensions.addEventListener(
      "change",
      ({ window, screen }) => {
        const topics: string[] = ["window"];

        if (window.width !== this.window.width) topics.push("width");
        if (window.height !== this.window.height) topics.push("height");

        this.window = window;

        const orientation =
          screen.height >= screen.width ? "portrait" : "landscape";
        if (orientation !== this.orientation) topics.push("orientation");
        this.orientation = orientation;

        this.notifyMedia(topics);
      }
    );

    this.appearanceListener = appearance.addChangeListener(
      ({ colorScheme }) => {
        if (this.colorSchemeSystem === "system") {
          this.colorScheme = colorScheme || "light";
          this.notifyMedia(["colorScheme"]);
        }
      }
    );
  }

  getSnapshot = () => {
    return this.snapshot;
  };

  getServerSnapshot() {
    return this.snapshot;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  destroy() {
    this.dimensionListener.remove();
    this.appearanceListener.remove();
  }

  notify() {
    for (const l of this.listeners) l();
  }

  subscribeMedia(listener: (topics: string[]) => void) {
    this.atRuleListeners.add(listener);
    return () => this.atRuleListeners.delete(listener);
  }

  notifyMedia(topics: string[]) {
    for (const l of this.atRuleListeners) l(topics);
    this.notify();
  }

  isEqual(a: StylesArray, b: StylesArray): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((style, index) => Object.is(style, b[index]));
  }

  prepare(className?: string, options: CreateSelectorOptions = {}): string {
    if (typeof className !== "string") {
      return "";
    }

    const selector = createNormalizedSelector(className, {
      ...options,
      platform: Platform.OS,
      composed: true,
    });

    if (this.preprocessed) {
      if (this.snapshot[className]) return className;

      const classNames = [className];

      if (options.scopedGroupActive) classNames.push("component-active");
      if (options.scopedGroupFocus) classNames.push("component-focus");
      if (options.scopedGroupHover) classNames.push("component-hover");

      const styleArray: StylesArray = [
        {
          $$css: true,
          [className]: classNames.join(" "),
        } as CompiledStyle,
      ];
      styleArray.dynamic = false;
      this.snapshot = {
        ...this.snapshot,
        [className]: styleArray,
      };
      return className;
    }

    if (this.snapshot[selector]) return selector;

    const topics = new Set<string>();

    let init = true;
    let isDynamic = false;
    const childStyles: ChildStyle[] = [];

    const reEvaluate = () => {
      const styleArray: StylesArray = [];

      for (const name of className.split(/\s+/)) {
        const normalizedSelector = createNormalizedSelector(name, {
          ...options,
          platform: Platform.OS,
        });
        const classNameStyles = this.upsertAtomicStyle(
          normalizedSelector,
          options
        );

        styleArray.push(...classNameStyles);

        // These values will not change, so we can skip them after the first run
        if (init) {
          if (classNameStyles.dynamic) {
            isDynamic = true;
          }

          if (classNameStyles.childStyles) {
            childStyles.push(...classNameStyles.childStyles);
          }

          for (const topic of classNameStyles.topics || []) {
            topics.add(topic);
          }
        }
      }

      if (styleArray.length > 0 || childStyles.length > 0) {
        styleArray.dynamic = isDynamic;

        if (childStyles.length > 0) {
          styleArray.childStyles = childStyles;
        }

        this.snapshot = {
          ...this.snapshot,
          [selector]: styleArray,
        };
      } else {
        this.snapshot = {
          ...this.snapshot,
          [selector]: emptyStyles,
        };
      }
    };

    reEvaluate();
    init = false;

    this.subscribeMedia((notificationTopics: string[]) => {
      if (notificationTopics.some((topic) => topics.has(topic))) {
        reEvaluate();
      }
    });

    return selector;
  }

  /**
   * ClassNames are made of multiple atomic styles. eg "a b" are the styles [a, b]
   *
   * This function will be called for each atomic style
   */
  upsertAtomicStyle(
    className: string,
    options: CreateSelectorOptions = {}
  ): StylesArray {
    // This atomic style has already been processed, we can skip it
    if (this.snapshot[className]) return this.snapshot[className];

    // To keep things consistent, even atomic styles are arrays
    const styleArray: StylesArray = this.styles[className]
      ? [this.styles[className]]
      : [];

    const atRulesTuple = this.atRules[className];

    // If there are no atRules, this style is static.
    // We can add it to the snapshot and early exit.
    if (!atRulesTuple) {
      if (styleArray.length > 0) {
        styleArray.dynamic = false;
        this.snapshot = { ...this.snapshot, [className]: styleArray };
      } else {
        this.snapshot = { ...this.snapshot, [className]: emptyStyles };
      }
      return styleArray;
    }

    // The dynamic version may have already been processed, we can skip it
    if (this.snapshot[className]) return this.snapshot[className];

    // These are the media topics the atomic style has subscribed to.
    // They may be things like window, window.width, orientation, colorScheme, etc
    const topics = new Set<string>();

    // When a topic has new information, this function will be called.
    // Its purpose is to compute
    const reEvaluate = () => {
      const childStyles: ChildStyle[] = [];

      const newStyles: StylesArray = [...styleArray];
      newStyles.dynamic = true;
      newStyles.topics = topics;

      for (const [index, atRules] of atRulesTuple.entries()) {
        let isForChildren = false;
        let unitKey: string | undefined;

        const childAtRules: AtRuleTuple[] = [];

        const atRulesResult = atRules.every(([rule, params]) => {
          /**
           * This is a magic string, but it makes sense
           * Child selectors look like this and will always start with (>
           *
           * @selector (> *:not(:first-child))
           * @selector (> *)
           */
          if (rule === "selector" && params && params.startsWith("(>")) {
            isForChildren = true;
            childAtRules.push([rule, params]);
            return true;
          }

          if (rule === "dynamic-style") {
            if (unitKey) {
              throw new Error("cannot have multiple unit keys");
            }

            unitKey = params;
            return true;
          }

          return matchAtRule({
            rule,
            params,
            platform: this.platform,
            width: this.window.width,
            height: this.window.height,
            colorScheme: this.colorScheme,
            orientation: this.orientation,
            ...options,
          });
        });

        if (!atRulesResult) {
          continue;
        }

        const stylesKey = createAtRuleSelector(className, index);

        const style = this.styles[stylesKey];

        if (unitKey) {
          for (const [key, value] of Object.entries(style)) {
            (style as Record<string, unknown>)[key] = units[unitKey](value);
          }
        }

        if (isForChildren) {
          childStyles.push({
            className: className,
            style,
            atRules: childAtRules,
          });
        } else {
          newStyles.push(style);
        }
      }

      if (childStyles.length > 0) {
        newStyles.childStyles = childStyles;
      }

      const existingStyles = this.snapshot[className];

      if (!existingStyles) {
        this.snapshot[className] = newStyles;
        return newStyles;
      }

      if (
        this.isEqual(existingStyles, newStyles) &&
        this.isEqual(
          existingStyles.childStyles || [],
          newStyles.childStyles || []
        )
      ) {
        return existingStyles;
      }

      this.snapshot =
        newStyles.length > 0 || newStyles?.childStyles?.length
          ? { ...this.snapshot, [className]: newStyles }
          : { ...this.snapshot, [className]: emptyStyles };

      return newStyles;
    };

    // Loop over the atRules and either subscribe to topics
    // or create matchAtRule functions
    for (const [[atRule, params]] of atRulesTuple) {
      if (atRule === "media" && params) {
        if (params.includes("width")) topics.add("width");
        if (params.includes("height")) topics.add("height");
        if (params.includes("orientation")) topics.add("orientation");
        if (params.includes("aspect-ratio")) topics.add("window");
        if (params.includes("prefers-color-scheme")) topics.add("colorScheme");
      }
    }

    this.subscribeMedia((notificationTopics: string[]) => {
      if (notificationTopics.some((topic) => topics.has(topic))) {
        reEvaluate();
      }
    });

    return reEvaluate();
  }

  getChildStyles<T>(parent: StylesArray<T>, options: MatchChildAtRuleOptions) {
    if (!parent.childStyles) return;

    const styles: Style[] = [];
    const classNames = new Set();

    for (const { className, style, atRules } of parent.childStyles) {
      const match = atRules.every(([rule, params]) => {
        return matchChildAtRule(rule, params, options);
      });

      if (match) {
        classNames.add(className);
        styles.push(style);
      }
    }

    if (styles.length === 0) {
      return;
    }

    const className = `${[...classNames].join(" ")}.child`;

    if (this.snapshot[className]) return this.snapshot[className];
    this.snapshot = { ...this.snapshot, [className]: styles };
    return this.snapshot[className];
  }
}

export const StoreContext = createContext(new StyleSheetStore());
