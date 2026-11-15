/**
 * Les projets dont le compte connecté est collaborateur (pas chef). Ils se
 * lisent sur le serveur à chaque synchronisation (cloud-sync.ts) et restent
 * sur le téléphone (localStorage) pour s'ouvrir sans réseau. Seul leur chef
 * les modifie. Sans compte, ils sont oubliés.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import { listTeamProjects, type TeamProject } from '@/backend/project-team';

const KEY = 'simuflow.projets-equipe';
const listeners = new Set<() => void>();

function isTeamProject(value: unknown): value is TeamProject {
  const item = value as TeamProject;
  return (
    typeof item?.chefName === 'string' &&
    typeof item.project?.id === 'string' &&
    typeof item.project.name === 'string' &&
    typeof item.project.createdAt === 'string'
  );
}

function read(): TeamProject[] {
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return Array.isArray(data) ? data.filter(isTeamProject) : [];
  } catch {
    return [];
  }
}

let teamProjects: TeamProject[] = read();

export function setTeamProjects(next: TeamProject[]) {
  teamProjects = next;
  try {
    if (next.length) globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // La liste vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

/** Relit les projets d'équipe. Un échec (réseau, script pas encore appliqué) garde la dernière liste. */
export async function refreshTeamProjects(): Promise<void> {
  try {
    setTeamProjects(await listTeamProjects());
  } catch (error) {
    if (__DEV__) console.warn('Projets d’équipe :', error);
  }
}

/** Plus de compte : les projets d'équipe ne sont plus lisibles. */
export function forgetTeamProjects() {
  if (teamProjects.length) setTeamProjects([]);
}

/** Retire tout de suite un projet quitté, sans attendre la synchronisation. */
export function dropTeamProject(id: string) {
  setTeamProjects(teamProjects.filter((item) => item.project.id !== id));
}

export function getTeamProject(id: string | null | undefined): TeamProject | undefined {
  return id ? teamProjects.find((item) => item.project.id === id) : undefined;
}

export function useTeamProjects(): TeamProject[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => teamProjects,
    () => teamProjects,
  );
}
