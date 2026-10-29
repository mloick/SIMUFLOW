/**
 * Accès aux process. Pour l'instant, les données sont fictives et chargées
 * avec un délai simulé ; le backend (Supabase) remplacera fetchProcesses.
 *
 * Le « scénario de démonstration » force un des états de la liste
 * (chargement, vide, erreur, hors connexion) pour les montrer sans réseau.
 * Il se choisit dans l'onglet Profil, en mode développement.
 *
 * Les process importés (écran Importer) sont affichés en tête de liste et
 * enregistrés sur le téléphone (saved-file.ts) : ils sont relus au démarrage.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { Process } from '@/domain';

import { demoProcesses } from './demo-processes';
import { readSaved, writeSaved } from './saved-file';

export type DemoScenario = 'contenu' | 'chargement' | 'vide' | 'erreur' | 'hors-ligne';

export const DEMO_SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: 'contenu', label: 'Contenu' },
  { value: 'chargement', label: 'Chargement' },
  { value: 'vide', label: 'Vide' },
  { value: 'erreur', label: 'Erreur' },
  { value: 'hors-ligne', label: 'Hors connexion' },
];

let scenario: DemoScenario = 'contenu';
const listeners = new Set<() => void>();

export function setDemoScenario(next: DemoScenario) {
  scenario = next;
  listeners.forEach((listener) => listener());
}

export function useDemoScenario(): DemoScenario {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => scenario,
    () => scenario,
  );
}

const SAVED_FORMAT = 'simuflow-imports';

function isProcess(value: unknown): value is Process {
  const process = value as Process;
  return (
    typeof process?.id === 'string' &&
    typeof process.name === 'string' &&
    Array.isArray(process.steps) &&
    Array.isArray(process.links)
  );
}

/** Relit les process enregistrés. Un fichier abîmé ou inconnu donne une liste vide. */
export function parseSaved(text: string | null): Process[] {
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    if (data?.format !== SAVED_FORMAT || !Array.isArray(data.processes)) return [];
    return data.processes.filter(isProcess);
  } catch {
    return [];
  }
}

function loadImported(): Process[] {
  try {
    return parseSaved(readSaved());
  } catch {
    return [];
  }
}

let imported: Process[] = loadImported();
const importListeners = new Set<() => void>();

function setImported(next: Process[]) {
  imported = next;
  importListeners.forEach((listener) => listener());
  try {
    writeSaved(JSON.stringify({ format: SAVED_FORMAT, version: 1, processes: next }));
  } catch (error) {
    console.warn('Les process importés n’ont pas pu être enregistrés.', error);
  }
}

/** Ajoute un process importé en tête de liste et l'enregistre. */
export function addImportedProcess(process: Process) {
  setImported([process, ...imported]);
}

/** Supprime un process importé (les process d'exemple ne se suppriment pas). */
export function removeImportedProcess(id: string) {
  setImported(imported.filter((process) => process.id !== id));
}

export function isImported(id: string): boolean {
  return imported.some((process) => process.id === id);
}

function useImportedProcesses(): Process[] {
  return useSyncExternalStore(
    (listener) => {
      importListeners.add(listener);
      return () => importListeners.delete(listener);
    },
    () => imported,
    () => imported,
  );
}

const LOADING_DELAY_MS = 700;

type FetchResult = { processes: Process[]; offline: boolean };

async function fetchProcesses(current: DemoScenario): Promise<FetchResult> {
  await new Promise((resolve) => setTimeout(resolve, LOADING_DELAY_MS));
  switch (current) {
    case 'chargement':
      return new Promise(() => {}); // ne répond jamais : le squelette reste affiché
    case 'erreur':
      throw new Error('Le serveur n’a pas répondu.');
    case 'vide':
      return { processes: [], offline: false };
    case 'hors-ligne':
      // Hors connexion, on montre la dernière version enregistrée.
      return { processes: demoProcesses.slice(0, 2), offline: true };
    default:
      return { processes: demoProcesses, offline: false };
  }
}

export type ProcessListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; processes: Process[]; offline: boolean };

/** Liste des process et fonction pour la recharger (bouton « Réessayer »). */
export function useProcessList(): ProcessListState & { reload: () => void } {
  const current = useDemoScenario();
  const [attempt, setAttempt] = useState(0);
  // Chaque chargement a sa clé : tant que le résultat de la clé en cours n'est
  // pas arrivé, l'écran affiche le chargement.
  const key = `${current}-${attempt}`;
  const [result, setResult] = useState<{ key: string; state: ProcessListState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProcesses(current).then(
      (data) => !cancelled && setResult({ key, state: { status: 'ready', ...data } }),
      () => !cancelled && setResult({ key, state: { status: 'error' } }),
    );
    return () => {
      cancelled = true;
    };
  }, [current, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const added = useImportedProcesses();
  const loaded = result?.key === key ? result.state : null;
  const state = useMemo<ProcessListState>(() => {
    if (!loaded) return { status: 'loading' };
    if (loaded.status !== 'ready' || added.length === 0) return loaded;
    return { ...loaded, processes: [...added, ...loaded.processes] };
  }, [loaded, added]);

  return { ...state, reload };
}

/** Un process par son identifiant (écran Détail). */
export function getProcess(id: string): Process | undefined {
  return imported.find((process) => process.id === id) ?? demoProcesses.find((process) => process.id === id);
}
