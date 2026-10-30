/**
 * L'état réel de la liste des process, calculé à partir de ce que l'app sait
 * (compte, synchronisation, réseau). Sans dépendance, pour être testé seul.
 */

import type { Process } from '@/domain';

import type { ProcessListState } from './process-store';

export type ListSignals = {
  connected: boolean;
  /** Une synchronisation a réussi depuis la connexion. */
  synced: boolean;
  /** Le téléphone garde déjà des process du compte. */
  hasCloudCopies: boolean;
  sync: 'idle' | 'syncing' | 'done' | 'error';
  /** L'erreur de synchronisation vient-elle du réseau ? */
  syncOffline: boolean;
  online: boolean | undefined;
  processes: Process[];
};

export function listState(signals: ListSignals): ProcessListState {
  const { connected, synced, hasCloudCopies, sync, syncOffline, online, processes } = signals;
  // Connecté sur un téléphone qui n'a encore rien du compte : on attend la première synchronisation.
  if (connected && !synced && !hasCloudCopies && online !== false) {
    if (sync === 'error' && !syncOffline) return { status: 'error' };
    if (sync === 'idle' || sync === 'syncing') return { status: 'loading' };
  }
  return { status: 'ready', processes, offline: online === false };
}
