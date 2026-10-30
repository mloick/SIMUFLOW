/**
 * Branche la synchronisation (sync.ts) sur l'app : le compte connecté, la
 * liste des process importés et le serveur.
 *
 * Elle se lance quand on se connecte, quand l'app revient au premier plan,
 * après un import ou une suppression, et à la demande (« Synchroniser »).
 * Sans compte, les copies déjà envoyées sont retirées du téléphone : elles sont
 * sur le serveur, et le prochain compte connecté ne doit pas les voir.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/backend/auth';
import { createCloudProcess, deleteCloudProcess, listCloudProcesses } from '@/backend/processes';

import { getImportEntries, setImportEntries, subscribeImports } from './process-store';
import { mergeAfterSync, syncEntries, type CloudApi } from './sync';

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'done'; at: Date }
  | { state: 'error'; message: string };

const api: CloudApi = { list: listCloudProcesses, create: createCloudProcess, remove: deleteCloudProcess };

let status: SyncStatus = { state: 'idle' };
const statusListeners = new Set<() => void>();
let running = false;
let again = false;
let connected = false;
/** Vrai pendant que la synchronisation réécrit la liste : ce n'est pas un changement de l'utilisateur. */
let writing = false;

function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((listener) => listener());
}

/** Lance une synchronisation ; si une est déjà en cours, une autre suivra. */
export async function syncNow() {
  if (!connected) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ state: 'syncing' });
  try {
    do {
      again = false;
      const before = getImportEntries();
      const result = await syncEntries(before, api);
      if (!connected) break; // déconnecté pendant l'envoi : on ne réécrit rien
      writing = true;
      setImportEntries(mergeAfterSync(before, result, getImportEntries()));
      writing = false;
    } while (again && connected);
    if (connected) setStatus({ state: 'done', at: new Date() });
  } catch (error) {
    // Hors connexion ou serveur injoignable : les changements attendent la prochaine fois.
    const offline = /fetch|network/i.test(String(error));
    setStatus({
      state: 'error',
      message: offline ? 'Hors connexion : vos process seront envoyés plus tard.' : 'La synchronisation a échoué.',
    });
    if (__DEV__) console.warn('Synchronisation des process :', error);
  } finally {
    running = false;
  }
}

/** Plus de compte : on retire du téléphone les copies du serveur, on garde le reste. */
function forgetCloudCopies() {
  const entries = getImportEntries();
  const kept = entries.filter((entry) => !entry.cloudId);
  if (kept.length !== entries.length) setImportEntries(kept);
  setStatus({ state: 'idle' });
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    () => status,
    () => status,
  );
}

/** À appeler une fois, à la racine de l'app. */
export function useCloudSync() {
  const session = useSession();
  const known = session !== undefined;
  const userId = session?.user.id;

  useEffect(() => {
    if (!known) return; // session pas encore lue
    connected = userId !== undefined;
    if (!connected) {
      forgetCloudCopies();
      return;
    }
    syncNow();
    // Un import ou une suppression : on synchronise (ou on repasse après la synchro en cours).
    const stopImports = subscribeImports(() => {
      if (!writing) syncNow();
    });
    const stopAppState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });
    return () => {
      stopImports();
      stopAppState.remove();
    };
  }, [known, userId]);
}
