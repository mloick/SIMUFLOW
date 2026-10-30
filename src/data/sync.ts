/**
 * Synchronisation des process importés avec le serveur (compte connecté).
 *
 * Le téléphone garde une liste d'entrées : un process, et, s'il est déjà sur
 * le serveur, son identifiant là-bas (`cloudId`). Une synchronisation :
 *
 * 1. lit les process du compte sur le serveur ;
 * 2. supprime sur le serveur ceux retirés sur le téléphone (`deleted`) ;
 * 3. envoie ceux qui ne sont pas encore sur le serveur ;
 * 4. envoie les modifications faites sur le téléphone (`modified`) ;
 * 5. reprend la version du serveur des autres (modifiés depuis un autre appareil) ;
 * 6. retire du téléphone ceux supprimés depuis un autre appareil ;
 * 7. ajoute ceux créés depuis un autre appareil.
 *
 * Un process modifié des deux côtés entre deux synchronisations : la dernière
 * version envoyée l'emporte.
 *
 * Écrit sans dépendre de Supabase : `api` est passé en paramètre, et les tests
 * lui donnent un faux serveur.
 */

import type { Process } from '@/domain';

export type SyncEntry = {
  process: Process;
  /** Identifiant sur le serveur, une fois envoyé. */
  cloudId?: string;
  /** Retiré sur le téléphone, à supprimer sur le serveur. */
  deleted?: true;
  /** Modifié sur le téléphone depuis le dernier envoi. */
  modified?: true;
};

export type CloudApi = {
  list(): Promise<Process[]>;
  create(process: Process): Promise<Process>;
  update(cloudId: string, process: Process): Promise<void>;
  remove(cloudId: string): Promise<void>;
};

export async function syncEntries(local: SyncEntry[], api: CloudApi): Promise<SyncEntry[]> {
  const remote = await api.list();
  const remoteById = new Map(remote.map((process) => [process.id, process]));
  const remoteIds = new Set(remoteById.keys());
  const next: SyncEntry[] = [];

  for (const entry of local) {
    if (entry.deleted) {
      // Pas encore envoyé, ou déjà parti du serveur : rien à faire. Sinon, on supprime.
      if (entry.cloudId && remoteIds.has(entry.cloudId)) {
        await api.remove(entry.cloudId);
        remoteIds.delete(entry.cloudId);
      }
      continue;
    }
    if (!entry.cloudId) {
      const created = await api.create(entry.process);
      next.push({ process: entry.process, cloudId: created.id });
      continue;
    }
    // Envoyé autrefois, absent aujourd'hui : supprimé depuis un autre appareil.
    const onServer = remoteById.get(entry.cloudId);
    if (!onServer) continue;
    if (entry.modified) {
      await api.update(entry.cloudId, entry.process);
      next.push({ process: entry.process, cloudId: entry.cloudId });
    } else {
      // Version du serveur, sous l'identifiant du téléphone (un écran ouvert le garde).
      next.push({ process: { ...onServer, id: entry.process.id }, cloudId: entry.cloudId });
    }
  }

  // Créés ailleurs : leur identifiant sur le téléphone est celui du serveur.
  const known = new Set(local.map((entry) => entry.cloudId));
  const added = remote
    .filter((process) => !known.has(process.id))
    .map((process): SyncEntry => ({ process, cloudId: process.id }));

  return [...added, ...next];
}

/**
 * Le téléphone a pu changer pendant la synchronisation (un import, une
 * suppression) : on garde ces changements par-dessus le résultat, ils partiront
 * à la synchronisation suivante.
 */
export function mergeAfterSync(before: SyncEntry[], result: SyncEntry[], now: SyncEntry[]): SyncEntry[] {
  const beforeIds = new Set(before.map((entry) => entry.process.id));
  const addedMeanwhile = now.filter((entry) => !beforeIds.has(entry.process.id));
  const nowById = new Map(now.map((entry) => [entry.process.id, entry]));
  const merged = result.flatMap((entry): SyncEntry[] => {
    const current = nowById.get(entry.process.id);
    // Absent avant la synchro : venu du serveur, on le garde.
    if (!beforeIds.has(entry.process.id)) return [entry];
    // Retiré pendant la synchro : à supprimer au prochain passage.
    if (!current) return entry.cloudId ? [{ ...entry, deleted: true }] : [];
    if (current.deleted) return [{ ...entry, deleted: true }];
    // Modifié pendant la synchro : la version du téléphone partira la prochaine fois.
    if (current.modified && current.process !== before.find((b) => b.process.id === entry.process.id)?.process)
      return [{ ...entry, process: current.process, modified: true }];
    return [entry];
  });
  return [...addedMeanwhile, ...merged];
}
