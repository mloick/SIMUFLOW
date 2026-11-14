/**
 * Guide « Installer SimuFlow sur l'écran d'accueil », montré dans la
 * présentation du premier lancement quand l'app est ouverte dans un navigateur.
 * Fonctions pures, sans dépendance au navigateur : install-guide-platform.web.ts
 * leur passe ce qu'il lit dans `navigator`.
 */

import { getT } from '@/i18n';

/** Appareil pour lequel montrer les étapes : iPhone ou iPad, Android, ou ordinateur. */
export type InstallPlatform = 'ios' | 'android' | 'desktop';

export type DeviceInfo = {
  userAgent: string;
  /** Nombre de points de contact de l'écran (navigator.maxTouchPoints). */
  touchPoints: number;
  /** L'app est déjà ouverte depuis l'écran d'accueil (plein écran, sans barre d'adresse). */
  standalone: boolean;
};

/** L'appareil, ou null si l'app est déjà installée : le guide n'a alors plus lieu d'être. */
export function detectInstallPlatform({ userAgent, touchPoints, standalone }: DeviceInfo): InstallPlatform | null {
  if (standalone) return null;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // Un iPad récent se présente comme un Mac, mais avec un écran tactile.
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

/** Les étapes à suivre, dans les mots des menus du navigateur et la langue de l'app. */
export function installSteps(platform: InstallPlatform): string[] {
  return getT().welcome.installSteps[platform];
}
