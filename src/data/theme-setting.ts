/**
 * Réglage « Apparence » du Profil : automatique (comme le téléphone), clair ou
 * sombre. Gardé sur le téléphone (localStorage). Sur iOS et Android, le choix
 * est aussi donné au système (`Appearance.setColorScheme`) pour que le clavier
 * et les fenêtres du système suivent ; dans le navigateur, seul l'app change.
 */

import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import '@/backend/local-storage';

export type ThemeMode = 'auto' | 'light' | 'dark';

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

const KEY = 'simuflow.apparence';
const listeners = new Set<() => void>();

function read(): ThemeMode {
  try {
    const value = globalThis.localStorage?.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function applyToSystem(next: ThemeMode) {
  if (Platform.OS === 'web') return;
  try {
    Appearance.setColorScheme(next === 'auto' ? 'unspecified' : next);
  } catch {
    // Sans module natif (tests), l'app suit quand même le choix.
  }
}

let mode = read();
applyToSystem(mode);

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  applyToSystem(next);
  try {
    globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // Le réglage vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => mode,
    () => 'auto',
  );
}

/** Le mode affiché : le choix de l'utilisateur, ou celui du téléphone en automatique. */
export function resolveScheme(mode: ThemeMode, system: string | null | undefined): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  return system === 'dark' ? 'dark' : 'light';
}
