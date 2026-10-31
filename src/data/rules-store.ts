/**
 * Règles de lecture apprises (src/import/rules.ts), enregistrées sur le
 * téléphone (saved-file.ts) : elles servent à chaque import suivant.
 *
 * Connecté, elles sont aussi gardées sur le compte (syncReadingRules, lancée
 * par cloud-sync.ts) : `pending` marque un changement pas encore envoyé, et
 * `forgotten` les règles oubliées ici, à retirer aussi du serveur.
 */

import { useSyncExternalStore } from 'react';

import type { Process } from '@/domain';
import {
  applyRules,
  learnRules,
  mergeRules,
  parseRules,
  reconcileRules,
  ruleKey,
  type ImportResult,
  type ReadingRule,
} from '@/import';

import { readSaved, writeSaved } from './saved-file';

const FILE = 'regles-lecture';
const FORMAT = 'simuflow-regles';

type RulesState = { rules: ReadingRule[]; pending: boolean; forgotten: string[] };

function load(): RulesState {
  try {
    const data = JSON.parse(readSaved(FILE) ?? 'null');
    if (data?.format !== FORMAT) return { rules: [], pending: false, forgotten: [] };
    const rules = parseRules(data.rules);
    const forgotten = Array.isArray(data.forgotten) ? data.forgotten.filter((k: unknown) => typeof k === 'string') : [];
    // Version 1 (avant les comptes) : tout est encore à envoyer.
    return { rules, pending: data.version === 1 ? rules.length > 0 : data.pending === true, forgotten };
  } catch {
    return { rules: [], pending: false, forgotten: [] };
  }
}

let state: RulesState = load();
const listeners = new Set<() => void>();

function setState(next: RulesState) {
  state = next;
  listeners.forEach((listener) => listener());
  try {
    writeSaved(JSON.stringify({ format: FORMAT, version: 2, ...next }), FILE);
  } catch (error) {
    console.warn('Les règles de lecture n’ont pas pu être enregistrées.', error);
  }
}

export function getReadingRules(): ReadingRule[] {
  return state.rules;
}

/** Un changement attend d'être envoyé au compte. */
export function hasPendingRules(): boolean {
  return state.pending;
}

export function subscribeRules(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReadingRules(): ReadingRule[] {
  return useSyncExternalStore(subscribeRules, getReadingRules, getReadingRules);
}

/** Retient ce qu'apprennent les corrections d'un process. Renvoie le nombre de règles apprises. */
export function learnFromCorrection(before: Process, after: Process): number {
  const learned = learnRules(before, after);
  if (learned.length) setState({ ...state, rules: mergeRules(state.rules, learned), pending: true });
  return learned.length;
}

export function forgetReadingRule(rule: ReadingRule) {
  setState({
    rules: state.rules.filter((other) => other !== rule),
    pending: true,
    forgotten: [...state.forgotten, ruleKey(rule)],
  });
}

/** Applique les règles à chaque process d'un import. `applied` : les règles qui ont servi, sans doublon. */
export function applyReadingRules(result: ImportResult): { result: ImportResult; applied: string[] } {
  const applied = new Set<string>();
  const processes = result.processes.map((process) => {
    const corrected = applyRules(process, state.rules);
    corrected.applied.forEach((line) => applied.add(line));
    return corrected.process;
  });
  return { result: { ...result, processes }, applied: [...applied] };
}

export type RulesApi = {
  get: () => Promise<ReadingRule[]>;
  save: (rules: ReadingRule[]) => Promise<void>;
};

/**
 * Accorde les règles du téléphone et celles du compte. Un changement fait
 * pendant l'envoi reste marqué, et partira à la synchronisation suivante.
 */
export async function syncReadingRules(api: RulesApi): Promise<void> {
  const before = state;
  const server = await api.get();
  const rules = reconcileRules(server, before.rules, before.pending, before.forgotten);
  if (before.pending) await api.save(rules);
  if (state !== before) return; // modifié pendant l'envoi : on repassera
  setState({ rules, pending: false, forgotten: [] });
}

/** Plus de compte : les règles déjà sur le compte quittent le téléphone ; celles pas encore envoyées restent. */
export function forgetCloudRules() {
  if (!state.pending && state.rules.length) setState({ rules: [], pending: false, forgotten: [] });
}
