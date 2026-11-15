/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { FamilyColors, Palettes } from '@/constants/theme';
import { usePalette } from '@/data/palette-setting';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Les couleurs de l'écran : la palette choisie dans le Profil, en clair ou en sombre. */
export function useTheme() {
  const scheme = useColorScheme();
  const palette = usePalette();
  return Palettes[palette][scheme === 'dark' ? 'dark' : 'light'];
}

/** Couleurs des familles de chemins, selon le mode clair ou sombre. */
export function useFamilyColors() {
  const scheme = useColorScheme();
  return FamilyColors[scheme === 'dark' ? 'dark' : 'light'];
}
