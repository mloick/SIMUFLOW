/**
 * Les process partagés avec le compte connecté (côté membre). Ils se lisent sur
 * le serveur à chaque synchronisation (cloud-sync.ts) et restent sur le
 * téléphone (localStorage) pour s'ouvrir sans réseau. Ils ne se modifient pas :
 * seul leur propriétaire les change. Sans compte, ils sont oubliés.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import { listSharedWithMe, type SharedProcess } from '@/backend/shared';

const KEY = 'simuflow.partages';
const listeners = new Set<() => void>();

function isShared(value: unknown): value is SharedProcess {
  const item = value as SharedProcess;
  return (
    typeof item?.cloudId === 'string' &&
    typeof item.ownerName === 'string' &&
    typeof item.process?.id === 'string' &&
    Array.isArray(item.process.steps) &&
    Array.isArray(item.process.links)
  );
}

function read(): SharedProcess[] {
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return Array.isArray(data) ? data.filter(isShared) : [];
  } catch {
    return [];
  }
}

let shared: SharedProcess[] = read();

export function setSharedProcesses(next: SharedProcess[]) {
  shared = next;
  try {
    if (next.length) globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // La liste vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

/** Relit les partages sur le serveur. Un échec (réseau, script pas encore appliqué) garde la dernière liste. */
export async function refreshShared(): Promise<void> {
  try {
    setSharedProcesses(await listSharedWithMe());
  } catch (error) {
    if (__DEV__) console.warn('Process partagés :', error);
  }
}

/** Plus de compte : les partages ne sont plus lisibles. */
export function forgetShared() {
  if (shared.length) setSharedProcesses([]);
}

export function getShared(id: string): SharedProcess | undefined {
  return shared.find((item) => item.process.id === id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSharedProcesses(): SharedProcess[] {
  return useSyncExternalStore(
    subscribe,
    () => shared,
    () => shared,
  );
}

export function useShared(id: string): SharedProcess | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getShared(id),
    () => getShared(id),
  );
}
