import { useColorScheme as useSystemColorScheme } from 'react-native';

import { resolveScheme, useThemeMode } from '@/data/theme-setting';

/** Clair ou sombre : le choix du Profil (« Apparence »), sinon celui du téléphone. */
export function useColorScheme(): 'light' | 'dark' {
  const mode = useThemeMode();
  const system = useSystemColorScheme();
  return resolveScheme(mode, system);
}
