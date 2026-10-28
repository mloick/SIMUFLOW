/**
 * Thème SimuFlow : les couleurs de la maquette (docs/maquette/), en mode clair
 * et en mode sombre. Les écrans lisent ces couleurs avec le hook useTheme().
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Couleurs de la marque, identiques dans les deux modes (logo, docs/logo/). */
export const Brand = {
  blue: '#007ec5',
  navy: '#0b2540',
} as const;

export const Colors = {
  light: {
    // Fonds
    background: '#f2f6fa',
    surface: '#ffffff',
    surfaceMuted: '#eef3f8',
    field: '#e3eaf2',
    border: '#dde5ee',
    fieldBorder: '#c3d0de',
    // Textes
    text: '#0b2540',
    textSecondary: '#4a5b70',
    link: '#006aa6',
    // Actions. Un peu plus foncé que Brand.blue pour que le texte blanc
    // des boutons reste lisible (contraste 4,75:1, minimum WCAG 4,5:1).
    primary: '#0078bd',
    onPrimary: '#ffffff',
    // Diagnostic : badges « Aucune anomalie », « avertissement », « erreur »
    success: '#0b6b4b',
    successBackground: '#e2f5ee',
    warning: '#9a4510',
    warningBackground: '#fdeedf',
    danger: '#a8261b',
    dangerBackground: '#fbe3e1',
  },
  dark: {
    background: '#0b1621',
    surface: '#15222f',
    surfaceMuted: '#1c2a38',
    field: '#1c2a38',
    border: '#1f2e3d',
    fieldBorder: '#2c3e50',
    text: '#e8eef5',
    textSecondary: '#a9b6c4',
    link: '#4fc3f0',
    primary: '#2ea3e0',
    onPrimary: '#0b1621',
    success: '#8fe3c4',
    successBackground: '#123a2e',
    warning: '#f6b27a',
    warningBackground: '#3d2614',
    danger: '#f4a49c',
    dangerBackground: '#3e1a17',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
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
