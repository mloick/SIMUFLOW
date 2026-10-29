/**
 * Résumé d'un process pour les écrans : nombre d'étapes, de décisions et
 * d'acteurs, et nombre d'anomalies par gravité.
 */

import { diagnose, type Issue } from './diagnostic';
import type { Process } from './types';

export type ProcessSummary = {
  stepCount: number;
  decisionCount: number;
  /** Acteurs distincts, dans l'ordre où ils apparaissent. */
  actors: string[];
  issues: Issue[];
  errorCount: number;
  warningCount: number;
};

export function summarize(process: Process): ProcessSummary {
  const issues = diagnose(process);
  const actors = [
    ...new Set(process.steps.map((step) => step.actor?.trim()).filter((actor): actor is string => !!actor)),
  ];

  return {
    stepCount: process.steps.length,
    decisionCount: process.steps.filter((step) => step.kind === 'decision').length,
    actors,
    issues,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
  };
}
