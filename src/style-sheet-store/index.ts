import { createContext } from "react";
import {
  StyleSheet,
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
  I18nManager,
} from "react-native";
import {
  matchAtRule,
  matchChildAtRule,
  MatchChildAtRuleOptions,
} from "./match-at-rule";
import {
  createAtRuleSelector,
  getStateBit,
  StateBitOptions,
} from "../shared/selector";
import { MediaRecord } from "../types/common";
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

export interface StylesArray<T = Style> extends Array<EitherStyle<T>> {
  childClassNames?: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var tailwindcss_react_native_style: Record<string, Style>;
  // eslint-disable-next-line no-var
  var tailwindcss_react_native_media: MediaRecord;
  // eslint-disable-next-line no-var
  var nativewind_styles: Record<string, Style>;
  // eslint-disable-next-line no-var
  var nativewind_at_rules: MediaRecord;
  // eslint-disable-next-line no-var
  var nativewind_masks: Record<string, number>;
  // eslint-disable-next-line no-var
  var nativewind_topics: Record<string, string[]>;
  // eslint-disable-next-line no-var
  var nativewind_child_classes: Record<string, string[]>;
}

const units: Record<
  string,
  (value: string | number) => string | number | Record<string, unknown>
> = {
  vw,
  vh,
};

export interface StyleSheetStoreConstructor {
  styles?: typeof global.tailwindcss_react_native_style;
  atRules?: typeof global.tailwindcss_react_native_media;
  dimensions?: Dimensions;
  appearance?: typeof Appearance;
  platform?: typeof Platform.OS;
  preprocessed?: boolean;
  colorScheme?: ColorSchemeSystem;
  topics?: Record<string, Array<string>>;
  masks?: Record<string, number>;
  childClasses?: Record<string, string[]>;

  // This is used for tests & snack demos
  dangerouslyCompileStyles?: (
    className: string,
    store: StyleSheetStore
  ) => void;
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
  dangerouslyCompileStyles: StyleSheetStoreConstructor["dangerouslyCompileStyles"];

  styles: Record<string, Style>;
  atRules: MediaRecord;
  topics: Record<string, Array<string>>;
  childClasses: Record<string, Array<string>>;
  masks: Record<string, number>;
  preprocessed: boolean;

  platform: typeof Platform.OS;
  window: ScaledSize;
  orientation: OrientationLockType;

  constructor({
    styles = (global.nativewind_styles ||= {}),
    atRules = (global.nativewind_at_rules ||= {}),
    masks = (global.nativewind_masks ||= {}),
    childClasses = (global.nativewind_child_classes ||= {}),
    topics = (global.nativewind_topics ||= {}),
    dimensions = Dimensions,
    appearance = Appearance,
    platform = Platform.OS,
    preprocessed = false,
    colorScheme,
    dangerouslyCompileStyles,
  }: StyleSheetStoreConstructor = {}) {
    super(colorScheme);

    this.platform = platform;
    this.styles = styles;
    this.atRules = atRules;
    this.masks = masks;
    this.childClasses = childClasses;
    this.topics = topics;
    this.preprocessed = preprocessed;
    this.window = dimensions.get("window");
    this.dangerouslyCompileStyles = dangerouslyCompileStyles;

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

  prepare(composedClassName?: string, options: StateBitOptions = {}): string {
    if (typeof composedClassName !== "string") {
      return "";
    }

    if (this.preprocessed)
      return this.preparePreprocessed(composedClassName, options);

    const stateBit = getStateBit(options);

    const snapshotKey = `(${composedClassName}).${stateBit}`;
    if (this.snapshot[snapshotKey]) return snapshotKey;

    this.dangerouslyCompileStyles?.(composedClassName, this);

    const classNames = composedClassName.split(/\s+/);
    const topics = new Set<string>();

    for (const className of classNames) {
      if (this.topics[className]) {
        for (const topic of this.topics[className]) {
          topics.add(topic);
        }
      }
    }

    const childStyles: string[] = [];

    const reEvaluate = () => {
      const styleArray: StylesArray = [];

      const stateBit = getStateBit({
        ...options,
        darkMode: this.colorScheme === "dark",
        rtl: I18nManager.isRTL,
        platform: Platform.OS,
      });

      for (const className of classNames) {
        const mask = this.masks[className] || 0;

        // If we match this class's state, then process it
        if (matchesMask(stateBit, mask)) {
          const classNameStyles = this.upsertAtomicStyle(className);
          styleArray.push(...classNameStyles);
          if (classNameStyles.childClassNames) {
            childStyles.push(...classNameStyles.childClassNames);
          }
        }
      }

      if (styleArray.length > 0 || childStyles.length > 0) {
        if (childStyles.length > 0) {
          styleArray.childClassNames = childStyles;
        }

        this.snapshot = {
          ...this.snapshot,
          [snapshotKey]: styleArray,
        };
      } else {
        this.snapshot = {
          ...this.snapshot,
          [snapshotKey]: emptyStyles,
        };
      }
    };

    reEvaluate();

    if (topics.size > 0) {
      this.subscribeMedia((notificationTopics: string[]) => {
        if (notificationTopics.some((topic) => topics.has(topic))) {
          reEvaluate();
        }
      });
    }

    return snapshotKey;
  }

  preparePreprocessed(
    className: string,
    {
      scopedGroupActive = false,
      scopedGroupFocus = false,
      scopedGroupHover = false,
    } = {}
  ): string {
    if (this.snapshot[className]) return className;

    const classNames = [className];

    if (scopedGroupActive) classNames.push("component-active");
    if (scopedGroupFocus) classNames.push("component-focus");
    if (scopedGroupHover) classNames.push("component-hover");

    const styleArray: StylesArray = [
      {
        $$css: true,
        [className]: classNames.join(" "),
      } as CompiledStyle,
    ];
    this.snapshot = {
      ...this.snapshot,
      [className]: styleArray,
    };
    return className;
  }

  /**
   * ClassNames are made of multiple atomic styles. eg "a b" are the styles [a, b]
   *
   * This function will be called for each atomic style
   */
  upsertAtomicStyle(className: string): StylesArray {
    // This atomic style has already been processed, we can skip it
    if (this.snapshot[className]) return this.snapshot[className];

    // To keep things consistent, even atomic styles are arrays
    const styleArray: StylesArray = this.styles[className]
      ? [this.styles[className]]
      : [];

    if (this.childClasses[className]) {
      styleArray.childClassNames = this.childClasses[className];
    }

    const atRulesTuple = this.atRules[className];

    // If there are no atRules, this style is static.
    // We can add it to the snapshot and early exit.
    if (!atRulesTuple) {
      this.snapshot =
        styleArray.length > 0
          ? { ...this.snapshot, [className]: styleArray }
          : { ...this.snapshot, [className]: emptyStyles };
      return styleArray;
    }

    // When a topic has new information, this function will be called.
    const reEvaluate = () => {
      const newStyles: StylesArray = [...styleArray];

      for (const [index, atRules] of atRulesTuple.entries()) {
        let unitKey: string | undefined;

        const atRulesResult = atRules.every(([rule, params]) => {
          if (rule === "selector") {
            // These atRules shouldn't be on the atomic styles, they only
            // apply to childStyles
            return false;
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
            width: this.window.width,
            height: this.window.height,
            orientation: this.orientation,
          });
        });

        if (!atRulesResult) {
          continue;
        }

        const stylesKey = createAtRuleSelector(className, index);

        // This causes performance issues on RNW <17, but hopefully people upgrade soon
        let style = flattenIfRNW(this.styles[stylesKey]);

        if (unitKey) {
          style = { ...style };
          for (const [key, value] of Object.entries(style)) {
            (style as Record<string, unknown>)[key] = units[unitKey](value);
          }
        }

        newStyles.push(style);
      }

      this.snapshot =
        newStyles.length > 0 || newStyles?.childClassNames?.length
          ? { ...this.snapshot, [className]: newStyles }
          : { ...this.snapshot, [className]: emptyStyles };

      return newStyles;
    };

    if (this.topics[className]) {
      const topics = new Set(this.topics[className]);
      this.subscribeMedia((notificationTopics: string[]) => {
        if (notificationTopics.some((topic) => topics.has(topic))) {
          reEvaluate();
        }
      });
    }

    return reEvaluate();
  }

  getChildStyles<T>(parent: StylesArray<T>, options: MatchChildAtRuleOptions) {
    if (!parent.childClassNames) return;

    const styles: Style[] = [];
    const classNames = new Set();

    for (const className of parent.childClassNames) {
      for (const [index, atRules] of this.atRules[className].entries()) {
        const match = atRules.every(([rule, params]) => {
          return matchChildAtRule(rule, params, options);
        });

        const stylesKey = createAtRuleSelector(className, index);
        const style = this.styles[stylesKey];

        if (match && style) {
          classNames.add(className);

          styles.push(style);
        }
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

const matchesMask = (value: number, mask: number) => (value & mask) === mask;
const flattenIfRNW = <T extends Style>(style: T | number): T => {
  return typeof style === "number"
    ? (StyleSheet.flatten(style) as unknown as T)
    : style;
};

export const StoreContext = createContext(new StyleSheetStore());
