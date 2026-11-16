/**
 * Tableau de bord d'un projet : où en est la relecture de chacun de ses
 * process, en un coup d'œil. Réutilise `validationOverview` process par
 * process, puis fait les totaux. Fonctions pures, testées dans
 * __tests__/dashboard.test.ts.
 */

import { validationOverview, type MemberReview, type ValidationMember, type ValidationOverview } from './validation';
import type { Process, Step } from './types';

/** État d'un process dans le tableau de bord. */
export type DashboardStatus = 'a_revoir' | 'en_relecture' | 'pas_partage' | 'valide';

/** Ce qu'on sait d'un process du projet : ses membres et leurs avis. */
export type DashboardInput = {
  process: Process;
  members: ValidationMember[];
  reviews: MemberReview[];
};

export type DashboardProcess = {
  process: Process;
  status: DashboardStatus;
  overview: ValidationOverview;
  /** Relectures faites (une étape relue par un membre = une relecture). */
  reviewed: number;
  /** Relectures attendues. */
  expected: number;
};

/** Une étape signalée « à revoir », avec le commentaire de celui qui l'a signalée. */
export type DashboardIssue = {
  process: Process;
  step: Step;
  member: ValidationMember;
  comment: string;
};

export type ProjectDashboard = {
  /** Les process, ceux qui demandent une action d'abord. */
  processes: DashboardProcess[];
  counts: Record<DashboardStatus, number>;
  reviewed: number;
  expected: number;
  /** De 0 à 100, arrondi. 0 s'il n'y a rien à relire. */
  percent: number;
  issues: DashboardIssue[];
  /** Personnes qui n'ont pas fini de relire au moins un process. */
  waitingOn: ValidationMember[];
};

/** Ordre d'affichage : d'abord ce qui demande une action. */
const ORDER: Record<DashboardStatus, number> = { a_revoir: 0, en_relecture: 1, pas_partage: 2, valide: 3 };

export function dashboardStatus(overview: ValidationOverview): DashboardStatus {
  if (overview.members.length === 0) return 'pas_partage';
  if (overview.toReviseCount > 0) return 'a_revoir';
  if (overview.fullyValidated) return 'valide';
  return 'en_relecture';
}

export function projectDashboard(inputs: DashboardInput[]): ProjectDashboard {
  const processes = inputs.map(({ process, members, reviews }): DashboardProcess => {
    const overview = validationOverview(process, members, reviews);
    let reviewed = 0;
    let expected = 0;
    for (const item of overview.members) {
      reviewed += item.validated + item.toRevise;
      expected += item.total;
    }
    return { process, status: dashboardStatus(overview), overview, reviewed, expected };
  });
  // `sort` garde l'ordre d'origine à égalité.
  processes.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const counts: Record<DashboardStatus, number> = { a_revoir: 0, en_relecture: 0, pas_partage: 0, valide: 0 };
  const issues: DashboardIssue[] = [];
  const waiting = new Map<string, ValidationMember>();
  let reviewed = 0;
  let expected = 0;
  for (const item of processes) {
    counts[item.status] += 1;
    reviewed += item.reviewed;
    expected += item.expected;
    for (const feedback of item.overview.steps) {
      for (const { member, comment } of feedback.toRevise) {
        issues.push({ process: item.process, step: feedback.step, member, comment });
      }
    }
    for (const progress of item.overview.members) {
      if (progress.state !== 'termine' && !waiting.has(progress.member.id)) {
        waiting.set(progress.member.id, progress.member);
      }
    }
  }

  return {
    processes,
    counts,
    reviewed,
    expected,
    percent: expected === 0 ? 0 : Math.round((reviewed / expected) * 100),
    issues,
    waitingOn: [...waiting.values()],
  };
}
