import { detectInstallPlatform, type InstallPlatform } from './install-guide';

/** Lit l'appareil dans le navigateur ; null si la web app est déjà ouverte depuis l'écran d'accueil. */
export function installPlatform(): InstallPlatform | null {
  if (typeof window === 'undefined') return null;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectInstallPlatform({ userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints ?? 0, standalone });
}
