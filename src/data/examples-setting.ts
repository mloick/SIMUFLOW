/**
 * Réglage « Afficher les exemples » du Profil, gardé sur le téléphone
 * (localStorage). Activé par défaut, pour découvrir l'app.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';

const KEY = 'simuflow.exemples';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let shown = read();

/** Les exemples sont-ils affichés ? Oui par défaut, pour découvrir l'app. */
export function setExamplesShown(next: boolean) {
  shown = next;
  try {
    globalThis.localStorage?.setItem(KEY, next ? 'on' : 'off');
  } catch {
    // Le réglage vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function useExamplesShown(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => shown,
    () => true,
  );
}
