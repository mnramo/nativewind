import { TailwindConfig } from "tailwindcss/tailwind-config";
import { extractStyles } from "../../../src/postcss/extract-styles";
import { StyleError, StyleRecord } from "../../../src/types/common";

import plugin from "../../../src/plugin";
import { nativePlugin } from "../../../src/plugin/native";

export type Test = [string, StyleRecord] | [string, StyleRecord, true];

export { spacing } from "./spacing";
export { createTests, expectError } from "./tests";

export function tailwindRunner(name: string, ...testCases: Array<Test[]>) {
  describe(name, () => {
    test.each(testCases.flat())("%s", assertStyles);
  });
}

export function assertStyles(
  css: string,
  styles: StyleRecord,
  shouldError = false
) {
  const errors: StyleError[] = [];

  const { errors: outputErrors, ...output } = extractStyles({
    theme: {},
    plugins: [
      plugin,
      nativePlugin({
        onError(error) {
          errors.push(error);
        },
      }),
    ],
    content: [
      { raw: "", extension: "html" },
    ] as unknown as TailwindConfig["content"],
    safelist: [css],
  });

  expect(output).toEqual({ styles });
  if (shouldError) {
    errors.push(...outputErrors);
    expect(errors.length).toBeGreaterThan(0);
  }
}
