import { describe, expect, it } from '@jest/globals';

import { detectInstallPlatform, INSTALL_STEPS } from '../install-guide';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('detectInstallPlatform', () => {
  it('reconnaît un iPhone', () => {
    expect(detectInstallPlatform({ userAgent: IPHONE, touchPoints: 5, standalone: false })).toBe('ios');
  });

  it('reconnaît un iPad qui se présente comme un Mac', () => {
    expect(detectInstallPlatform({ userAgent: MAC, touchPoints: 5, standalone: false })).toBe('ios');
  });

  it('garde un vrai Mac comme ordinateur', () => {
    expect(detectInstallPlatform({ userAgent: MAC, touchPoints: 0, standalone: false })).toBe('desktop');
  });

  it('reconnaît Android et Windows', () => {
    expect(detectInstallPlatform({ userAgent: ANDROID, touchPoints: 5, standalone: false })).toBe('android');
    expect(detectInstallPlatform({ userAgent: WINDOWS, touchPoints: 0, standalone: false })).toBe('desktop');
  });

  it('ne montre rien quand la web app est déjà installée', () => {
    expect(detectInstallPlatform({ userAgent: IPHONE, touchPoints: 5, standalone: true })).toBeNull();
  });

  it('a des étapes pour chaque appareil', () => {
    for (const steps of Object.values(INSTALL_STEPS)) expect(steps.length).toBeGreaterThan(0);
  });
});
