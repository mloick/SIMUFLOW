/**
 * Guide « Installer SimuFlow sur l'écran d'accueil », montré dans la
 * présentation du premier lancement quand l'app est ouverte dans un navigateur.
 * Fonctions pures, sans dépendance au navigateur : install-guide-platform.web.ts
 * leur passe ce qu'il lit dans `navigator`.
 */

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

/** Les étapes à suivre, dans les mots des menus du navigateur. */
export const INSTALL_STEPS: Record<InstallPlatform, string[]> = {
  ios: [
    'Dans Safari, touchez les trois points (•••), puis « Partager » (ou directement le bouton Partager, en bas).',
    'Touchez « Sur l’écran d’accueil » (faites défiler si besoin).',
    'Touchez « Ajouter », puis ouvrez SimuFlow depuis son icône : il s’ouvre comme une app, en plein écran.',
  ],
  android: [
    'Dans Chrome, touchez les trois points (⋮) en haut à droite.',
    'Touchez « Ajouter à l’écran d’accueil » ou « Installer l’application ».',
    'Confirmez avec « Installer », puis ouvrez SimuFlow depuis son icône : il s’ouvre comme une app, en plein écran.',
  ],
  desktop: [
    'Sur un téléphone, ouvrez ce même lien, puis suivez les étapes qui s’affichent.',
    'Sur ordinateur, Chrome et Edge proposent aussi « Installer SimuFlow », avec l’icône à droite de la barre d’adresse.',
  ],
};
