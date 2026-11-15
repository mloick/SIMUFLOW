/**
 * Thème SimuFlow : les couleurs de la maquette (docs/maquette/), en mode clair
 * et en mode sombre. Les écrans lisent ces couleurs avec le hook useTheme().
 */

import "@/global.css";

import { Platform } from "react-native";

/** Couleurs de la marque, identiques dans les deux modes (logo, docs/logo/). */
export const Brand = {
  blue: "#007ec5",
  navy: "#0b2540",
} as const;

/** Les quatre palettes proposées dans le Profil (« Apparence »). Océan est celle par défaut. */
export type PaletteId = "ocean" | "aurore" | "menthe" | "corail";
export const PALETTES: PaletteId[] = ["ocean", "aurore", "menthe", "corail"];
export const DEFAULT_PALETTE: PaletteId = "ocean";

/** Toutes les couleurs qu'un écran peut lire avec useTheme(). */
export type ThemeColors = {
  // Fonds
  background: string;
  surface: string;
  surfaceMuted: string;
  field: string;
  border: string;
  fieldBorder: string;
  // Textes
  text: string;
  textSecondary: string;
  link: string;
  // Actions
  primary: string;
  onPrimary: string;
  primaryBackground: string;
  /** Seconde couleur de la palette (progression, petits rappels). */
  accent: string;
  // Diagnostic : badges « Aucune anomalie », « avertissement », « erreur »
  success: string;
  successBackground: string;
  warning: string;
  warningBackground: string;
  danger: string;
  dangerBackground: string;
};

export type ThemeColor = keyof ThemeColors;

/** Fonds, textes et diagnostic : communs aux quatre palettes. */
const neutralLight = {
  background: "#f3f6fa",
  surface: "#ffffff",
  surfaceMuted: "#eef2f7",
  field: "#e6ecf3",
  border: "#dde5ee",
  fieldBorder: "#c3d0de",
  text: "#0e1b2c",
  textSecondary: "#566476",
  onPrimary: "#ffffff",
  success: "#0b6b4b",
  successBackground: "#e2f5ee",
  warning: "#9a4510",
  warningBackground: "#fdeedf",
  danger: "#a8261b",
  dangerBackground: "#fbe3e1",
};

const neutralDark = {
  background: "#0c121b",
  surface: "#151e2b",
  surfaceMuted: "#1c2635",
  field: "#1c2635",
  border: "#2a374a",
  fieldBorder: "#33435a",
  text: "#eef3f8",
  textSecondary: "#a3b2c4",
  onPrimary: "#ffffff",
  success: "#8fe3c4",
  successBackground: "#123a2e",
  warning: "#f6b27a",
  warningBackground: "#3d2614",
  danger: "#f4a49c",
  dangerBackground: "#3e1a17",
};

/**
 * Ce qui change d'une palette à l'autre. Contrastes vérifiés (minimum WCAG 4,5:1) :
 * texte blanc sur `primary`, `link` sur le fond, sur `surfaceMuted` et sur `primaryBackground`.
 * En clair, `link` est un peu plus foncé que `primary` pour rester lisible sur les fonds teintés.
 */
const tints: Record<PaletteId, { light: PaletteTint; dark: PaletteTint }> = {
  ocean: {
    light: {
      primary: "#0077bb",
      link: "#006aa6",
      primaryBackground: "#e2f0fa",
      accent: "#14a88c",
    },
    dark: {
      primary: "#0077bb",
      link: "#5cb8ee",
      primaryBackground: "#0f2c42",
      accent: "#14a88c",
    },
  },
  aurore: {
    light: {
      primary: "#5a4de6",
      link: "#5246d6",
      primaryBackground: "#ecebfd",
      accent: "#e85d87",
    },
    dark: {
      primary: "#5a4de6",
      link: "#a59dff",
      primaryBackground: "#241f52",
      accent: "#e85d87",
    },
  },
  menthe: {
    light: {
      primary: "#0b7d70",
      link: "#0a6b60",
      primaryBackground: "#ddf2ee",
      accent: "#e09612",
    },
    dark: {
      primary: "#0b7d70",
      link: "#4fd1bf",
      primaryBackground: "#0e3631",
      accent: "#e09612",
    },
  },
  corail: {
    light: {
      primary: "#c4462c",
      link: "#ad3c25",
      primaryBackground: "#fcebe5",
      accent: "#2b4c8c",
    },
    dark: {
      primary: "#c4462c",
      link: "#ff9c84",
      primaryBackground: "#43201a",
      accent: "#5b7fc4",
    },
  },
};

type PaletteTint = Pick<
  ThemeColors,
  "primary" | "link" | "primaryBackground" | "accent"
>;

export const Palettes = Object.fromEntries(
  PALETTES.map((id) => [
    id,
    {
      light: { ...neutralLight, ...tints[id].light },
      dark: { ...neutralDark, ...tints[id].dark },
    },
  ]),
) as Record<PaletteId, { light: ThemeColors; dark: ThemeColors }>;

/** La palette par défaut (Océan), pour ce qui ne suit pas le choix de l'utilisateur. */
export const Colors = Palettes[DEFAULT_PALETTE];

/**
 * Couleurs des familles de chemins (vue « Tous les cas »), dans l'ordre :
 * bleu, vert, orange, violet, rose, turquoise. Au-delà de six, on recommence.
 */
export const FamilyColors = {
  light: ["#0078bd", "#0b8a5f", "#c26a05", "#7a4fc9", "#c2185b", "#00838f"],
  dark: ["#4fb8ec", "#5fd3a6", "#f6b27a", "#b99cf2", "#f48fb1", "#5ed3dc"],
} as const;

/** Nom de chaque couleur de famille, dans le même ordre, pour les textes (« En bleu, … »). */
export const FamilyColorNames = [
  "bleu",
  "vert",
  "orange",
  "violet",
  "rose",
  "turquoise",
] as const;

/**
 * Police de l'app : Plus Jakarta Sans, chargée au démarrage (src/app/_layout.tsx).
 * Chaque graisse est un fichier à part : on choisit le nom selon la graisse voulue,
 * sans demander au système de grossir le trait lui-même.
 */
export const FontFaces = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

/** Le fichier de police qui correspond à une graisse (400 par défaut, « bold » = 700). */
export function fontFaceFor(weight: string | number | undefined): string {
  const value = weight === "bold" ? 700 : Number(weight ?? 400) || 400;
  if (value >= 800) return FontFaces.extraBold;
  if (value >= 700) return FontFaces.bold;
  if (value >= 600) return FontFaces.semiBold;
  if (value >= 500) return FontFaces.medium;
  return FontFaces.regular;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 12,
  medium: 16,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
