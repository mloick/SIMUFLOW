/**
 * Réglage « Rappels d'échéance » de l'onglet Profil, gardé sur le téléphone
 * (localStorage, base SQLite du téléphone sur iOS et Android). Activé par
 * défaut : sans l'autorisation du système, rien ne s'affiche de toute façon.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';

const KEY = 'simuflow.notifications';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = read();

export function areRemindersEnabled(): boolean {
  return enabled;
}

export function setRemindersEnabled(next: boolean) {
  enabled = next;
  try {
    globalThis.localStorage?.setItem(KEY, next ? 'on' : 'off');
  } catch {
    // Le réglage vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function useRemindersEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
    () => true,
  );
}
