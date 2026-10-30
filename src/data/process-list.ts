/**
 * La liste des process affichée par l'écran Process, avec ses 5 états réels :
 *
 * - chargement : connecté, première synchronisation en cours, aucun process du compte encore sur le téléphone ;
 * - erreur : cette première synchronisation a échoué (le serveur répond mal) ;
 * - hors connexion : le téléphone n'a pas Internet (expo-network) ; on montre la dernière version enregistrée ;
 * - vide : aucun process (aujourd'hui les exemples sont toujours là) ;
 * - contenu : les process importés, puis les exemples.
 *
 * En mode développement, le scénario de démonstration du Profil force un état.
 */

import { useMemo } from 'react';

import { useSession } from '@/backend/auth';

import { syncNow, useSyncStatus } from './cloud-sync';
import { demoProcesses } from './demo-processes';
import { listState } from './list-state';
import { useOnline } from './network';
import {
  getImportEntries,
  useDemoScenario,
  useImportedProcesses,
  useSimulatedProcessList,
  type ProcessListState,
} from './process-store';

export function useProcessList(): ProcessListState & { reload: () => void } {
  const scenario = useDemoScenario();
  const simulated = useSimulatedProcessList();
  const imported = useImportedProcesses();
  const sync = useSyncStatus();
  const online = useOnline();
  const session = useSession();

  const hasCloudCopies = getImportEntries().some((entry) => entry.cloudId);
  const real = useMemo(
    () =>
      listState({
        connected: Boolean(session),
        synced: sync.synced,
        hasCloudCopies,
        sync: sync.state,
        syncOffline: sync.state === 'error' && sync.offline,
        online,
        processes: [...imported, ...demoProcesses],
      }),
    [session, sync, hasCloudCopies, online, imported],
  );

  if (scenario !== 'contenu') return simulated;
  return { ...real, reload: syncNow };
}
