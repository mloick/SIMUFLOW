/**
 * Alertes du partage, sans serveur de notifications : à chaque
 * synchronisation, l'app compare ce qu'elle voit à ce qu'elle avait vu, et en
 * tire des alertes. Trois cas :
 *
 * - membre : un process est partagé avec moi ;
 * - propriétaire : un membre signale une étape à revoir ;
 * - propriétaire : le process est entièrement validé.
 *
 * Fonctions pures, testées dans __tests__/share-alerts.test.ts.
 */

import type { Process } from './types';
import { validationOverview, type MemberReview } from './validation';

export type ShareAlertKind = 'partage' | 'a_revoir' | 'valide';

export type ShareAlert = {
  id: string;
  kind: ShareAlertKind;
  title: string;
  body: string;
  /** Écran à ouvrir : la fiche du process ou son suivi de validation. */
  target: { pathname: '/process/[id]' | '/validation/[id]'; id: string };
  /** Date de détection (ISO). */
  at: string;
};

/** Ce que l'app voit à une synchronisation. */
export type ShareSnapshot = {
  /** Process partagés avec moi. */
  shared: { cloudId: string; localId: string; name: string; ownerName: string }[];
  /** Mes process sur le compte, avec leurs membres et leurs avis. */
  owned: {
    cloudId: string;
    localId: string;
    process: Process;
    members: { id: string; actor: string | null }[];
    reviews: (MemberReview & { updatedAt: string })[];
  }[];
};

/** Ce qui a déjà donné lieu à une alerte (gardé sur le téléphone). */
export type ShareAlertState = {
  shared: string[];
  /** Avis « à revoir » déjà signalés : process, membre, étape et date de l'avis. */
  toRevise: string[];
  validated: string[];
};

const reviseKey = (cloudId: string, review: MemberReview & { updatedAt: string }) =>
  `${cloudId}:${review.memberId}:${review.stepId}:${review.updatedAt}`;

/**
 * Compare `snapshot` à `previous` : renvoie les nouvelles alertes et l'état à
 * garder. La toute première fois (`previous` absent), rien n'est signalé :
 * l'état est seulement noté, pour ne pas alerter sur tout l'existant.
 */
export function detectShareAlerts(
  previous: ShareAlertState | null,
  snapshot: ShareSnapshot,
  now: Date,
): { alerts: ShareAlert[]; state: ShareAlertState } {
  const at = now.toISOString();
  const state: ShareAlertState = { shared: [], toRevise: [], validated: [] };
  const alerts: ShareAlert[] = [];

  for (const item of snapshot.shared) {
    state.shared.push(item.cloudId);
    if (previous && !previous.shared.includes(item.cloudId)) {
      alerts.push({
        id: `partage:${item.cloudId}:${at}`,
        kind: 'partage',
        title: 'Nouveau process partagé',
        body: `${item.ownerName} partage « ${item.name} » avec vous. Relisez votre partie.`,
        target: { pathname: '/process/[id]', id: item.localId },
        at,
      });
    }
  }

  for (const item of snapshot.owned) {
    const titles = new Map(item.process.steps.map((step) => [step.id, step.title || 'Sans titre']));
    const memberIds = new Set(item.members.map((member) => member.id));
    const toRevise = item.reviews.filter((review) => review.status === 'a_revoir' && memberIds.has(review.memberId));
    const fresh = toRevise.filter((review) => previous && !previous.toRevise.includes(reviseKey(item.cloudId, review)));
    state.toRevise.push(...toRevise.map((review) => reviseKey(item.cloudId, review)));
    if (fresh.length > 0) {
      const steps = [...new Set(fresh.map((review) => titles.get(review.stepId) ?? 'une étape'))];
      alerts.push({
        id: `a_revoir:${item.cloudId}:${at}`,
        kind: 'a_revoir',
        title: steps.length > 1 ? `${steps.length} étapes à revoir` : 'Une étape à revoir',
        body:
          steps.length > 1
            ? `Dans « ${item.process.name} » : ${steps.map((title) => `« ${title} »`).join(', ')}.`
            : `« ${steps[0]} », dans « ${item.process.name} ».`,
        target: { pathname: '/validation/[id]', id: item.localId },
        at,
      });
    }

    const overview = validationOverview(
      item.process,
      item.members.map((member) => ({ ...member, name: '' })),
      item.reviews,
    );
    if (overview.fullyValidated) {
      state.validated.push(item.cloudId);
      if (previous && !previous.validated.includes(item.cloudId)) {
        alerts.push({
          id: `valide:${item.cloudId}:${at}`,
          kind: 'valide',
          title: 'Process entièrement validé',
          body: `Tous les membres ont validé « ${item.process.name} ».`,
          target: { pathname: '/validation/[id]', id: item.localId },
          at,
        });
      }
    }
  }

  return { alerts, state };
}
