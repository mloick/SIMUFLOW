import { describe, expect, it } from '@jest/globals';

import { getThemeMode, resolveScheme, setThemeMode } from '../theme-setting';

describe('réglage Apparence', () => {
  it('suit le téléphone en automatique, sinon garde le choix', () => {
    expect(resolveScheme('auto', 'dark')).toBe('dark');
    expect(resolveScheme('auto', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('garde le choix sur le téléphone', () => {
    setThemeMode('dark');
    expect(getThemeMode()).toBe('dark');
    expect(globalThis.localStorage?.getItem('simuflow.apparence')).toBe('dark');
    setThemeMode('auto');
    expect(getThemeMode()).toBe('auto');
  });
});
