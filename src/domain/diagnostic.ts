/**
 * Diagnostic d'un process : la liste des anomalies, les plus graves en premier.
 * Règles reprises du prototype web (docs/technique.md, « Cœur du simulateur »).
 */

import { buildGraph, canReachEnd, reachableFromStarts } from './graph';
import type { Process } from './types';

export type Severity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'no-start'
  | 'multiple-starts'
  | 'no-end'
  | 'empty-title'
  | 'isolated-step'
  | 'unreachable'
  | 'dead-end'
  | 'cannot-finish'
  | 'decision-single-exit'
  | 'unlabeled-branch'
  | 'duplicate-label'
  | 'ambiguous-exits'
  | 'dangling-link';

export type Issue = {
  severity: Severity;
  code: IssueCode;
  /** Étape concernée, pour la montrer sur le schéma (bouton « Voir »). */
  stepId?: string;
  linkId?: string;
  /** Valeurs reprises dans le message : nombre d'étapes, libellé en double. */
  params?: { count?: number; label?: string };
};

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function diagnose(process: Process): Issue[] {
  const graph = buildGraph(process);
  const issues: Issue[] = [];
  const reachable = reachableFromStarts(graph);
  const finishes = canReachEnd(graph);

  if (graph.starts.length === 0) {
    issues.push({ severity: 'error', code: 'no-start' });
  } else if (graph.starts.length > 1) {
    issues.push({
      severity: 'info',
      code: 'multiple-starts',
      stepId: graph.starts[0].id,
      params: { count: graph.starts.length },
    });
  }
  if (graph.ends.length === 0) {
    issues.push({ severity: 'error', code: 'no-end' });
  }

  for (const step of process.steps) {
    const outgoing = graph.outgoing.get(step.id)!;
    const incoming = graph.incoming.get(step.id)!;

    if (step.title.trim() === '') {
      issues.push({ severity: 'warning', code: 'empty-title', stepId: step.id });
    }
    if (outgoing.length === 0 && incoming.length === 0) {
      issues.push({ severity: 'warning', code: 'isolated-step', stepId: step.id });
      continue;
    }
    if (graph.starts.length > 0 && !reachable.has(step.id) && step.kind !== 'start') {
      issues.push({ severity: 'warning', code: 'unreachable', stepId: step.id });
    }
    if (outgoing.length === 0 && step.kind !== 'end') {
      issues.push({ severity: 'warning', code: 'dead-end', stepId: step.id });
    } else if (graph.ends.length > 0 && outgoing.length > 0 && !finishes.has(step.id)) {
      issues.push({ severity: 'warning', code: 'cannot-finish', stepId: step.id });
    }

    if (step.kind === 'decision') {
      if (outgoing.length < 2) {
        issues.push({ severity: 'error', code: 'decision-single-exit', stepId: step.id });
      }
      const labels = new Set<string>();
      for (const link of outgoing) {
        const label = link.label?.trim();
        if (!label) {
          issues.push({ severity: 'warning', code: 'unlabeled-branch', stepId: step.id, linkId: link.id });
        } else if (labels.has(label.toLowerCase())) {
          issues.push({ severity: 'warning', code: 'duplicate-label', stepId: step.id, params: { label } });
        } else {
          labels.add(label.toLowerCase());
        }
      }
    } else if (outgoing.filter((link) => !link.label?.trim()).length > 1) {
      issues.push({ severity: 'info', code: 'ambiguous-exits', stepId: step.id });
    }
  }

  for (const link of graph.danglingLinks) {
    issues.push({ severity: 'warning', code: 'dangling-link', linkId: link.id });
  }

  // Tri stable : à gravité égale, l'ordre du process est gardé.
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

const MESSAGES: Record<IssueCode, (params: Issue['params']) => string> = {
  'no-start': () => 'Aucun point de départ : ajoutez une étape de début.',
  'multiple-starts': (p) => `${p?.count} points de départ : la simulation demandera lequel utiliser.`,
  'no-end': () => 'Aucune étape de fin : le process ne se termine nulle part.',
  'empty-title': () => 'Étape sans titre.',
  'isolated-step': () => 'Étape reliée à aucune autre.',
  unreachable: () => 'Étape que l’on ne peut jamais atteindre depuis le début.',
  'dead-end': () => 'Impasse : l’étape n’a pas de suite alors qu’elle n’est pas une fin.',
  'cannot-finish': () => 'Aucune fin atteignable depuis cette étape (boucle sans sortie).',
  'decision-single-exit': () => 'Décision avec une seule sortie.',
  'unlabeled-branch': () => 'Branche sans libellé après une décision (oui, non…).',
  'duplicate-label': (p) => `Deux branches portent le même libellé « ${p?.label} ».`,
  'ambiguous-exits': () => 'Plusieurs sorties sans libellé : choix ou étapes en parallèle ? À préciser.',
  'dangling-link': () => 'Lien relié à une étape qui n’existe pas.',
};

/** Message en français, pour l'utilisateur. */
export function describeIssue(issue: Issue): string {
  return MESSAGES[issue.code](issue.params);
}
