import {
  Platform,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
} from "react-native";

import { fontFaceFor, Fonts, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "subtitle"
    | "small"
    | "smallBold"
    | "link"
    | "code";
  themeColor?: ThemeColor;
};

/** Texte aux couleurs du thème. Les tailles reprennent celles de la maquette. */
export function ThemedText({
  style,
  type = "default",
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? (type === "link" ? "link" : "text")];
  // Plus Jakarta Sans : le fichier de la bonne graisse, plutôt qu'un trait grossi par le système.
  const font =
    type === "code"
      ? null
      : {
          fontFamily: fontFaceFor(
            (StyleSheet.flatten([styles[type], style]) as TextStyle | undefined)
              ?.fontWeight,
          ),
          fontWeight: "normal" as const,
        };

  return <Text style={[{ color }, styles[type], style, font]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 600,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
