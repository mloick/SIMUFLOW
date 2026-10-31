/**
 * Demandes suivies en vrai (src/tracking/tracking.ts), gardées sur ce
 * téléphone (localStorage : base SQLite du téléphone sur iOS et Android).
 * Elles ne sont pas envoyées au serveur : les rappels d'échéance sont
 * programmés par ce téléphone.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import type { Tracking } from '@/tracking/tracking';

const KEY = 'simuflow.suivis';
const listeners = new Set<() => void>();

function read(): Tracking[] {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item) => typeof item?.id === 'string' && Array.isArray(item.steps))
      : [];
  } catch {
    return [];
  }
}

let trackings = read();

function save(next: Tracking[]) {
  trackings = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Gardé pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

export function getTracking(id: string): Tracking | undefined {
  return trackings.find((item) => item.id === id);
}

/** Ajoute ou remplace un suivi. */
export function saveTracking(tracking: Tracking) {
  const others = trackings.filter((item) => item.id !== tracking.id);
  save([...others, tracking]);
}

export function removeTracking(id: string) {
  save(trackings.filter((item) => item.id !== id));
}

/** Les suivis (d'un process, si `processId` est donné), en cours d'abord, puis du plus récent au plus ancien. */
export function useTrackings(processId?: string): Tracking[] {
  const all = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => trackings,
    () => trackings,
  );
  return all
    .filter((item) => !processId || item.processId === processId)
    .sort(
      (a, b) => Number(Boolean(a.finishedAt)) - Number(Boolean(b.finishedAt)) || b.startedAt.localeCompare(a.startedAt),
    );
}
