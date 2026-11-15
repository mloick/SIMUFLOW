import { describe, expect, it } from '@jest/globals';

import { fontFaceFor, Palettes, PALETTES } from '@/constants/theme';

import { getPalette, setPalette } from '../palette-setting';

/** Contraste WCAG entre deux couleurs « #rrggbb ». */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe('réglage Couleurs', () => {
  it('commence sur Océan et garde le choix sur le téléphone', () => {
    expect(getPalette()).toBe('ocean');
    setPalette('corail');
    expect(getPalette()).toBe('corail');
    expect(globalThis.localStorage?.getItem('simuflow.palette')).toBe('corail');
    setPalette('ocean');
  });

  it('reste lisible dans chaque palette, en clair et en sombre', () => {
    for (const id of PALETTES) {
      for (const colors of [Palettes[id].light, Palettes[id].dark]) {
        expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
        for (const background of [colors.background, colors.surface, colors.surfaceMuted, colors.primaryBackground]) {
          expect(contrast(colors.link, background)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(colors.text, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('choisit le fichier de police selon la graisse', () => {
    expect(fontFaceFor(undefined)).toBe('PlusJakartaSans_400Regular');
    expect(fontFaceFor('bold')).toBe('PlusJakartaSans_700Bold');
    expect(fontFaceFor(600)).toBe('PlusJakartaSans_600SemiBold');
    expect(fontFaceFor('800')).toBe('PlusJakartaSans_800ExtraBold');
  });
});
