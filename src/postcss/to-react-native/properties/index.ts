import { TextStyle } from "react-native";
import { aspectRatio } from "./aspect-ratio";
import { flex } from "./flex";
import { fontFamily } from "./font-family";
import { only } from "./only";
import { position } from "./position";

export const properties = {
  alignContent: only<"alignContent">([
    "flex-start",
    "flex-end",
    "center",
    "stretch",
    "space-between",
    "space-around",
  ]),
  alignItems: only<"alignItems">([
    "flex-start",
    "flex-end",
    "center",
    "stretch",
    "baseline",
  ]),
  alignSelf: only<"alignSelf">([
    "auto",
    "flex-start",
    "flex-end",
    "center",
    "stretch",
    "baseline",
  ]),
  aspectRatio,
  columns: only([]),
  order: only([]),
  gridRowStart: only([]),
  gridRowEnd: only([]),
  gridColumnStart: only([]),
  gridColumnEnd: only([]),
  strokeWidth: only({ number: true }),
  backgroundColor: only({ color: true }),
  borderBottomWidth: only<"borderBottomWidth">({ number: true }),
  borderEndWidth: only<"borderEndWidth">({ number: true }),
  borderLeftWidth: only<"borderLeftWidth">({ number: true }),
  borderRightWidth: only<"borderRightWidth">({ number: true }),
  borderStartWidth: only<"borderStartWidth">({ number: true }),
  borderTopWidth: only<"borderTopWidth">({ number: true }),
  borderLeftColor: only({ color: true }),
  borderRightColor: only({ color: true }),
  borderBottomColor: only({ color: true }),
  borderTopColor: only({ color: true }),
  borderWidth: only<"borderWidth">({ number: true }),
  borderStyle: only(["solid", "dotted", "dashed"]),
  bottom: only<"bottom">({ number: true, units: ["px", "%"] }),
  direction: only<"direction">(["inherit", "ltr", "rtl"]),
  display: only<"display">(["none", "flex"]),
  end: only<"end">({ number: true, units: ["px", "%"] }),
  height: only<"height">({ number: true, units: ["px", "%"] }),
  minHeight: only<"minHeight">({ number: true, units: ["px", "%"] }),
  maxHeight: only<"maxHeight">({ number: true, units: ["px", "%"] }),
  flex,
  overflow: only<"overflow">(["visible", "hidden", "scroll"]),
  position,
  flexBasis: only<"flexBasis">({ number: true, units: ["%", "px"] }),
  top: only<"top">({ number: true, units: ["px", "%"] }),
  left: only<"left">({ number: true, units: ["px", "%"] }),
  right: only<"right">({ number: true, units: ["px", "%"] }),
  margin: only<"margin">({ number: true, units: ["px", "%"] }),
  marginBottom: only<"marginBottom">({ number: true, units: ["px", "%"] }),
  marginLeft: only<"marginLeft">({ number: true, units: ["px", "%"] }),
  marginRight: only<"marginRight">({ number: true, units: ["px", "%"] }),
  marginTop: only<"marginTop">({ number: true, units: ["px", "%"] }),
  width: only<"width">({ number: true, units: ["px", "%"] }),
  minWidth: only<"minWidth">({ number: true, units: ["px", "%"] }),
  maxWidth: only<"maxWidth">({ number: true, units: ["px", "%"] }),
  zIndex: only<"zIndex">({ number: true }),
  color: only<"color", TextStyle>({ color: true }),
  fontSize: only<"fontSize", TextStyle>({ number: true }),
  fontStyle: only<"fontStyle", TextStyle>(["normal", "italic"]),
  fontWeight: only<"fontWeight", TextStyle>([
    "normal",
    "bold",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ]),
  // fontVariant: only<"fontVariant", TextStyle>([
  //   ["small-caps"],
  //   "oldstyle-nums",
  //   "lining-nums",
  //   "tabular-nums",
  //   "proportional-nums",
  // ]),
  fontFamily,
  letterSpacing: only<"letterSpacing", TextStyle>({ number: true }),
  lineHeight: only<"lineHeight", TextStyle>({ number: true }),
  textAlign: only<"textAlign", TextStyle>([
    "auto",
    "left",
    "right",
    "center",
    "justify",
  ]),
  textTransform: only<"textTransform", TextStyle>([
    "none",
    "uppercase",
    "lowercase",
    "capitalize",
  ]),
  textDecorationColor: only<"textDecorationColor", TextStyle>({ color: true }),
  textDecorationStyle: only<"textDecorationStyle", TextStyle>([
    "solid",
    "double",
    "dotted",
    "dashed",
  ]),
};
