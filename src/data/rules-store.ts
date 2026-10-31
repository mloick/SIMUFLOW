/**
 * Règles de lecture apprises (src/import/rules.ts), enregistrées sur le
 * téléphone (saved-file.ts) : elles servent à chaque import suivant.
 */

import { useSyncExternalStore } from 'react';

import type { Process } from '@/domain';
import { applyRules, learnRules, mergeRules, parseRules, type ImportResult, type ReadingRule } from '@/import';

import { readSaved, writeSaved } from './saved-file';

const FILE = 'regles-lecture';
const FORMAT = 'simuflow-regles';

function load(): ReadingRule[] {
  try {
    const data = JSON.parse(readSaved(FILE) ?? 'null');
    return data?.format === FORMAT ? parseRules(data.rules) : [];
  } catch {
    return [];
  }
}

let rules: ReadingRule[] = load();
const listeners = new Set<() => void>();

function setRules(next: ReadingRule[]) {
  rules = next;
  listeners.forEach((listener) => listener());
  try {
    writeSaved(JSON.stringify({ format: FORMAT, version: 1, rules: next }), FILE);
  } catch (error) {
    console.warn('Les règles de lecture n’ont pas pu être enregistrées.', error);
  }
}

export function getReadingRules(): ReadingRule[] {
  return rules;
}

export function useReadingRules(): ReadingRule[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => rules,
    () => rules,
  );
}

/** Retient ce qu'apprennent les corrections d'un process. Renvoie le nombre de règles apprises. */
export function learnFromCorrection(before: Process, after: Process): number {
  const learned = learnRules(before, after);
  if (learned.length) setRules(mergeRules(rules, learned));
  return learned.length;
}

export function forgetReadingRule(rule: ReadingRule) {
  setRules(rules.filter((other) => other !== rule));
}

/** Applique les règles à chaque process d'un import. `applied` : les règles qui ont servi, sans doublon. */
export function applyReadingRules(result: ImportResult): { result: ImportResult; applied: string[] } {
  const applied = new Set<string>();
  const processes = result.processes.map((process) => {
    const corrected = applyRules(process, rules);
    corrected.applied.forEach((line) => applied.add(line));
    return corrected.process;
  });
  return { result: { ...result, processes }, applied: [...applied] };
}
