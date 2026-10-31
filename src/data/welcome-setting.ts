/**
 * La présentation du premier lancement (écran `bienvenue`) : déjà vue ou non,
 * gardé sur le téléphone (localStorage). Le Profil permet de la revoir.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';

const KEY = 'simuflow.bienvenue';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'vue';
  } catch {
    // Sans stockage, on ne force pas la présentation à chaque lancement.
    return true;
  }
}

let seen = read();

export function setWelcomeSeen() {
  seen = true;
  try {
    globalThis.localStorage?.setItem(KEY, 'vue');
  } catch {
    // Vue pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function useWelcomeSeen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => seen,
    () => true,
  );
}
