import { tailwindRunner } from "./runner";

tailwindRunner("Layout - Flex Direction", [
  ["flex-row", { styles: { "flex-row": { flexDirection: "row" } } }],
  // prettier-ignore
  ["flex-row-reverse", { styles: { "flex-row-reverse": { flexDirection: "row-reverse" } } } ],
  ["flex-col", { styles: { "flex-col": { flexDirection: "column" } } }],
  // prettier-ignore
  ["flex-col-reverse", { styles: { "flex-col-reverse": { flexDirection: "column-reverse" } } } ],
]);
