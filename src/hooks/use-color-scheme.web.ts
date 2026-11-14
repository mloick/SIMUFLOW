import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { resolveScheme, useThemeMode } from '@/data/theme-setting';

const subscribe = () => () => {};

/**
 * Clair ou sombre : le choix du Profil (« Apparence »), sinon celui du
 * navigateur. Pendant le rendu statique, toujours clair, puis recalculé une
 * fois la page chargée.
 */
export function useColorScheme(): 'light' | 'dark' {
  // false during static rendering / hydration, true once running on the client
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mode = useThemeMode();
  const system = useSystemColorScheme();
  return hasHydrated ? resolveScheme(mode, system) : 'light';
}
