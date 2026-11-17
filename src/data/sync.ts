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
 * Un process modifié des deux côtés entre deux synchronisations (le téléphone
 * hors connexion, la version web) : les deux versions sont fusionnées à partir
 * de la dernière version connue du serveur (`base`), étape par étape et lien
 * par lien (src/domain/merge.ts). Si une même étape a changé différemment des
 * deux côtés, la version du serveur est gardée et celle du téléphone part comme
 * une copie, sans rien perdre. Une entrée sans `base` (enregistrée par une
 * ancienne version de l'app) garde l'ancienne règle : la version du téléphone
 * remplace celle du serveur.
 *
 * Écrit sans dépendre de Supabase : `api` est passé en paramètre, et les tests
 * lui donnent un faux serveur.
 */

import { mergeProcess, sameProcess, type Process } from '@/domain';

export type SyncEntry = {
  process: Process;
  /** Identifiant sur le serveur, une fois envoyé. */
  cloudId?: string;
  /** Retiré sur le téléphone, à supprimer sur le serveur. */
  deleted?: true;
  /** Modifié sur le téléphone depuis le dernier envoi. */
  modified?: true;
  /** Dernière version connue du serveur (envoyée ou reçue) : la base de la fusion. */
  base?: Process;
};

export type CloudApi = {
  list(): Promise<Process[]>;
  create(process: Process): Promise<Process>;
  update(cloudId: string, process: Process): Promise<void>;
  remove(cloudId: string): Promise<void>;
};

export type SyncOptions = {
  /** Nom de la copie gardée après un conflit (par défaut : « <nom> (copie) »). */
  copyName?: (name: string) => string;
  /** Identifiant sur le téléphone de cette copie. */
  newId?: () => string;
  /** Prévenu pour chaque process en conflit, avec le nom de la copie. */
  onConflict?: (copyName: string) => void;
};

export async function syncEntries(local: SyncEntry[], api: CloudApi, options: SyncOptions = {}): Promise<SyncEntry[]> {
  const copyName = options.copyName ?? ((name: string) => `${name} (copie)`);
  const newId = options.newId ?? (() => `copie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
      next.push({ process: entry.process, cloudId: created.id, base: entry.process });
      continue;
    }
    // Envoyé autrefois, absent aujourd'hui : supprimé depuis un autre appareil.
    const onServer = remoteById.get(entry.cloudId);
    if (!onServer) continue;
    // Version du serveur, sous l'identifiant du téléphone (un écran ouvert le garde).
    const theirs: Process = { ...onServer, id: entry.process.id };
    if (!entry.modified) {
      next.push({ process: theirs, cloudId: entry.cloudId, base: theirs });
      continue;
    }
    // Personne d'autre n'a touché au process (ou pas de base connue) : ma version part telle quelle.
    if (!entry.base || sameProcess(entry.base, theirs)) {
      await api.update(entry.cloudId, entry.process);
      next.push({ process: entry.process, cloudId: entry.cloudId, base: entry.process });
      continue;
    }
    // Modifié des deux côtés : on fusionne.
    const { process: merged, conflicts } = mergeProcess(entry.base, entry.process, theirs);
    if (conflicts.length === 0) {
      if (!sameProcess(merged, theirs)) await api.update(entry.cloudId, merged);
      next.push({ process: merged, cloudId: entry.cloudId, base: merged });
      continue;
    }
    // Conflit : la version du serveur reste, la mienne part comme une copie.
    const copy: Process = { ...entry.process, id: newId(), name: copyName(entry.process.name.trim()) };
    const created = await api.create(copy);
    options.onConflict?.(copy.name);
    next.push({ process: theirs, cloudId: entry.cloudId, base: theirs });
    next.push({ process: copy, cloudId: created.id, base: copy });
  }

  // Créés ailleurs : leur identifiant sur le téléphone est celui du serveur.
  const known = new Set(local.map((entry) => entry.cloudId));
  const added = remote
    .filter((process) => !known.has(process.id))
    .map((process): SyncEntry => ({ process, cloudId: process.id, base: process }));

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
