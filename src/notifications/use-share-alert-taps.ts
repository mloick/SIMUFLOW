/**
 * Toucher une alerte du partage ouvre l'écran qu'elle concerne : la fiche du
 * process partagé, ou le suivi de sa validation. Appelé une fois, dans
 * src/app/_layout.tsx.
 */

import { router, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useShareAlertTaps } from './notifications';

export function useShareAlertNavigation() {
  const open = useCallback((path: string) => router.push(path as Href), []);
  useShareAlertTaps(open);
}
