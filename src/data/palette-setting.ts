/**
 * Réglage « Couleurs » du Profil : la palette de l'app (Océan, Aurore, Menthe
 * ou Corail). Gardé sur le téléphone (localStorage), comme le mode clair/sombre.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import { DEFAULT_PALETTE, PALETTES, type PaletteId } from '@/constants/theme';

const KEY = 'simuflow.palette';
const listeners = new Set<() => void>();

function read(): PaletteId {
  try {
    const value = globalThis.localStorage?.getItem(KEY);
    return PALETTES.includes(value as PaletteId) ? (value as PaletteId) : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

let palette = read();

export function getPalette(): PaletteId {
  return palette;
}

export function setPalette(next: PaletteId) {
  palette = next;
  try {
    globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // Le réglage vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function usePalette(): PaletteId {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => palette,
    () => DEFAULT_PALETTE,
  );
}
