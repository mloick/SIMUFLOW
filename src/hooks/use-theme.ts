/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, FamilyColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}

/** Couleurs des familles de chemins, selon le mode clair ou sombre. */
export function useFamilyColors() {
  const scheme = useColorScheme();
  return FamilyColors[scheme === 'dark' ? 'dark' : 'light'];
}
