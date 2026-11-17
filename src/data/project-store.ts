/**
 * Les projets : ils regroupent plusieurs process (le process garde
 * l'identifiant de son projet, `projectId`). Le compte qui crée un projet en
 * est le chef. Les projets restent sur le téléphone (localStorage) et,
 * connecté, se synchronisent avec le serveur (project-sync.ts), juste avant les
 * process (cloud-sync.ts). Sans compte, les projets déjà envoyés sont oubliés.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import type { Project } from '@/domain';
import { newUuid } from '@/utils/uuid';

import { clearProjectFromProcesses } from './process-store';
import { mergeProjectsAfterSync, syncProjects, type ProjectApi, type ProjectEntry } from './project-sync';

const KEY = 'simuflow.projets';
const listeners = new Set<() => void>();

function isEntry(value: unknown): value is ProjectEntry {
  const entry = value as ProjectEntry;
  return (
    typeof entry?.project?.id === 'string' &&
    typeof entry.project.name === 'string' &&
    typeof entry.project.createdAt === 'string'
  );
}

/** Relit les projets enregistrés ; un contenu abîmé donne une liste vide. */
export function parseProjects(text: string | null): ProjectEntry[] {
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function read(): ProjectEntry[] {
  try {
    return parseProjects(globalThis.localStorage?.getItem(KEY) ?? null);
  } catch {
    return [];
  }
}

let entries: ProjectEntry[] = read();
let projects: Project[] = visible(entries);

function visible(list: ProjectEntry[]): Project[] {
  return list.filter((entry) => !entry.deleted).map((entry) => entry.project);
}

function setEntries(next: ProjectEntry[]) {
  entries = next;
  projects = visible(next);
  try {
    if (next.length) globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Les projets valent pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeProjects(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProjects(): Project[] {
  return useSyncExternalStore(
    subscribeProjects,
    () => projects,
    () => projects,
  );
}

export function getProject(id: string | null | undefined): Project | undefined {
  return id ? projects.find((project) => project.id === id) : undefined;
}

/** Crée un projet (en tête de liste) ; il partira au serveur à la prochaine synchronisation. */
export function createProject(name: string, description?: string): Project {
  const project: Project = {
    id: newUuid(),
    name: name.trim(),
    ...(description?.trim() ? { description: description.trim() } : {}),
    createdAt: new Date().toISOString(),
  };
  setEntries([{ project }, ...entries]);
  return project;
}

/** Renomme un projet ou change sa description. */
export function updateProject(id: string, name: string, description?: string) {
  setEntries(
    entries.map((entry) => {
      if (entry.project.id !== id) return entry;
      const project: Project = {
        id: entry.project.id,
        createdAt: entry.project.createdAt,
        name: name.trim(),
        ...(description?.trim() ? { description: description.trim() } : {}),
      };
      return entry.synced ? { ...entry, project, modified: true } : { project };
    }),
  );
}

/** Supprime un projet. Ses process restent, hors projet. */
export function removeProject(id: string) {
  setEntries(
    entries.flatMap((entry): ProjectEntry[] => {
      if (entry.project.id !== id) return [entry];
      return entry.synced ? [{ ...entry, deleted: true }] : [];
    }),
  );
  clearProjectFromProcesses(id);
}

/** Le projet est-il déjà sur le serveur ? (Il faut qu'il y soit pour inviter une équipe.) */
export function isProjectSynced(id: string): boolean {
  return entries.some((entry) => entry.project.id === id && entry.synced && !entry.deleted);
}

/** Des changements attendent d'être envoyés au serveur. */
export function hasPendingProjects(): boolean {
  return entries.some((entry) => !entry.synced || entry.modified || entry.deleted);
}

/** Synchronise les projets avec le serveur. Lève une erreur si le serveur ne répond pas. */
export async function syncProjectList(api: ProjectApi): Promise<void> {
  const before = entries;
  const result = await syncProjects(before, api);
  setEntries(mergeProjectsAfterSync(before, result, entries));
}

/** Plus de compte : on oublie les projets déjà envoyés, on garde les autres. */
export function forgetCloudProjects() {
  const kept = entries.filter((entry) => !entry.synced);
  if (kept.length !== entries.length) setEntries(kept);
}
