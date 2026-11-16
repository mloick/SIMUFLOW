/**
 * Diagnostic d'un process : la liste des anomalies, les plus graves en premier.
 * Règles reprises du prototype web (docs/technique.md, « Cœur du simulateur »).
 */

import { getT, type Messages } from '@/i18n';
import { buildGraph, canReachEnd, reachableFromStarts } from './graph';
import { reachableFromSplits } from './parallel';
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
  | 'parallel-no-branch'
  | 'join-without-split'
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
  const afterSplit = reachableFromSplits(graph);

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
    } else if (step.kind === 'parallel') {
      // Une étape « En parallèle » n'a pas besoin de libellés : toutes ses sorties sont prises.
      if (outgoing.length < 2 && incoming.length < 2) {
        issues.push({ severity: 'info', code: 'parallel-no-branch', stepId: step.id });
      } else if (incoming.length >= 2 && !afterSplit.has(step.id)) {
        // Jonction que rien ne lance en parallèle : une seule branche y arrive, elle attendrait sans fin.
        issues.push({ severity: 'warning', code: 'join-without-split', stepId: step.id, params: { count: incoming.length } });
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

/** Message pour l'utilisateur, dans la langue de l'app. */
export function describeIssue(issue: Issue, t: Messages = getT()): string {
  return t.issues.messages[issue.code](issue.params?.count, issue.params?.label);
}

export type IssueExplanation = {
  title: string;
  /** Phrase qui nomme l'étape concernée, quand il y en a une. */
  detail: string;
};

/** Titre court et phrase détaillée d'une anomalie, pour l'écran Détail et le PDF. */
export function explainIssue(issue: Issue, process: Process, t: Messages = getT()): IssueExplanation {
  const step = process.steps.find((s) => s.id === issue.stepId);
  const title = t.issues.titles[issue.code];
  if (!step) return { title, detail: describeIssue(issue, t) };

  const { details } = t.issues;
  const name = details.name(step.title.trim() || t.untitled);
  const code = issue.code;
  const detail =
    code === 'dead-end' ||
    code === 'cannot-finish' ||
    code === 'unreachable' ||
    code === 'isolated-step' ||
    code === 'decision-single-exit' ||
    code === 'unlabeled-branch' ||
    code === 'ambiguous-exits' ||
    code === 'parallel-no-branch'
      ? details[code](name)
      : code === 'duplicate-label'
        ? details[code](name, issue.params?.label)
        : code === 'multiple-starts' || code === 'join-without-split'
          ? details[code](name, issue.params?.count)
          : describeIssue(issue, t);
  return { title, detail };
}
