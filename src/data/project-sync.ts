/**
 * Synchronisation des projets avec le serveur (compte connecté).
 *
 * Un projet garde le même identifiant sur le téléphone et sur le serveur (un
 * UUID choisi à sa création). Chaque entrée dit seulement s'il est déjà envoyé
 * (`synced`), modifié depuis (`modified`) ou retiré (`deleted`). Une
 * synchronisation :
 *
 * 1. lit les projets du compte sur le serveur ;
 * 2. supprime sur le serveur ceux retirés sur le téléphone ;
 * 3. envoie ceux qui n'y sont pas encore, puis les modifications ;
 * 4. reprend la version du serveur des autres, oublie ceux supprimés ailleurs ;
 * 5. ajoute ceux créés depuis un autre appareil.
 *
 * Écrit sans dépendre de Supabase : `api` est passé en paramètre, et les tests
 * lui donnent un faux serveur.
 */

import type { Project } from '@/domain';

export type ProjectEntry = {
  project: Project;
  /** Déjà envoyé au serveur. */
  synced?: true;
  /** Modifié sur le téléphone depuis le dernier envoi. */
  modified?: true;
  /** Retiré sur le téléphone, à supprimer sur le serveur. */
  deleted?: true;
};

export type ProjectApi = {
  list(): Promise<Project[]>;
  create(project: Project): Promise<void>;
  update(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
};

export async function syncProjects(local: ProjectEntry[], api: ProjectApi): Promise<ProjectEntry[]> {
  const remote = await api.list();
  const remoteById = new Map(remote.map((project) => [project.id, project]));
  const next: ProjectEntry[] = [];

  for (const entry of local) {
    const { id } = entry.project;
    const onServer = remoteById.get(id);
    if (entry.deleted) {
      if (onServer) await api.remove(id);
      continue;
    }
    if (!entry.synced) {
      // Jamais envoyé (ou envoyé sans que le téléphone l'ait su) : on le crée ou on le met à jour.
      if (onServer) await api.update(entry.project);
      else await api.create(entry.project);
      next.push({ project: entry.project, synced: true });
      continue;
    }
    // Envoyé autrefois, absent aujourd'hui : supprimé depuis un autre appareil.
    if (!onServer) continue;
    if (entry.modified) {
      await api.update(entry.project);
      next.push({ project: entry.project, synced: true });
    } else {
      next.push({ project: onServer, synced: true });
    }
  }

  const known = new Set(local.map((entry) => entry.project.id));
  const added = remote
    .filter((project) => !known.has(project.id))
    .map((project): ProjectEntry => ({ project, synced: true }));
  return [...added, ...next];
}

/**
 * Le téléphone a pu changer pendant la synchronisation : on garde ces
 * changements par-dessus le résultat, ils partiront la fois suivante.
 */
export function mergeProjectsAfterSync(
  before: ProjectEntry[],
  result: ProjectEntry[],
  now: ProjectEntry[],
): ProjectEntry[] {
  const beforeById = new Map(before.map((entry) => [entry.project.id, entry]));
  const nowById = new Map(now.map((entry) => [entry.project.id, entry]));
  const resultIds = new Set(result.map((entry) => entry.project.id));
  const addedMeanwhile = now.filter((entry) => !beforeById.has(entry.project.id) && !resultIds.has(entry.project.id));
  const merged = result.flatMap((entry): ProjectEntry[] => {
    const id = entry.project.id;
    const previous = beforeById.get(id);
    if (!previous) return [entry]; // venu du serveur
    const current = nowById.get(id);
    if (!current || current.deleted) return [{ ...entry, deleted: true }];
    if (current !== previous) return [{ project: current.project, synced: true, modified: true }];
    return [entry];
  });
  return [...addedMeanwhile, ...merged];
}
