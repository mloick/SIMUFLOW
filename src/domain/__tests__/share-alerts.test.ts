import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '../exemples';
import { detectShareAlerts, type ShareSnapshot } from '../share-alerts';

const now = new Date('2026-11-14T16:00:00Z');
const shared = { cloudId: 'c1', localId: 'partage-c1', name: 'Arrivée d’un collaborateur', ownerName: 'Julie Martin' };
const owned = (reviews: ShareSnapshot['owned'][number]['reviews']): ShareSnapshot['owned'][number] => ({
  cloudId: 'c2',
  localId: 'import-1',
  process: demandeMateriel,
  members: [
    { id: 'k', actor: 'Responsable' },
    { id: 'i', actor: 'Achats' },
  ],
  reviews,
});
const review = (memberId: string, stepId: string, status: 'valide' | 'a_revoir', updatedAt = 't1') => ({
  memberId,
  stepId,
  status,
  comment: status === 'a_revoir' ? 'Plutôt 2 JO' : null,
  updatedAt,
});

describe('alertes du partage', () => {
  it('ne signale rien la première fois, et note ce qu’il voit', () => {
    const { alerts, state } = detectShareAlerts(
      null,
      { shared: [shared], owned: [owned([review('i', 'commande', 'a_revoir')])] },
      now,
    );
    expect(alerts).toEqual([]);
    expect(state.shared).toEqual(['c1']);
    expect(state.toRevise).toHaveLength(1);
  });

  it('signale un nouveau partage', () => {
    const empty = { shared: [], toRevise: [], validated: [] };
    const { alerts } = detectShareAlerts(empty, { shared: [shared], owned: [] }, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: 'partage',
      body: 'Julie Martin partage « Arrivée d’un collaborateur » avec vous. Relisez votre partie.',
      target: { pathname: '/process/[id]', id: 'partage-c1' },
    });
  });

  it('signale une étape à revoir une seule fois, et de nouveau si l’avis change', () => {
    const first = detectShareAlerts(
      { shared: [], toRevise: [], validated: [] },
      { shared: [], owned: [owned([review('i', 'commande', 'a_revoir')])] },
      now,
    );
    expect(first.alerts.map((alert) => [alert.kind, alert.title, alert.body])).toEqual([
      ['a_revoir', 'Une étape à revoir', '« Passer la commande », dans « Demande de matériel ».'],
    ]);
    expect(first.alerts[0].target).toEqual({ pathname: '/validation/[id]', id: 'import-1' });
    const again = detectShareAlerts(
      first.state,
      { shared: [], owned: [owned([review('i', 'commande', 'a_revoir')])] },
      now,
    );
    expect(again.alerts).toEqual([]);
    const changed = detectShareAlerts(
      first.state,
      { shared: [], owned: [owned([review('i', 'commande', 'a_revoir', 't2'), review('k', 'refus', 'a_revoir')])] },
      now,
    );
    expect(changed.alerts[0].title).toBe('2 étapes à revoir');
    expect(changed.alerts[0].body).toBe(
      'Dans « Demande de matériel » : « Passer la commande », « Prévenir du refus ».',
    );
  });

  it('signale le process entièrement validé une fois', () => {
    const all = [
      review('k', 'validation', 'valide'),
      review('k', 'refus', 'valide'),
      review('i', 'commande', 'valide'),
    ];
    const empty = { shared: [], toRevise: [], validated: [] };
    const first = detectShareAlerts(empty, { shared: [], owned: [owned(all)] }, now);
    expect(first.alerts.map((alert) => alert.kind)).toEqual(['valide']);
    expect(first.alerts[0].body).toBe('Tous les membres ont validé « Demande de matériel ».');
    expect(detectShareAlerts(first.state, { shared: [], owned: [owned(all)] }, now).alerts).toEqual([]);
    // Plus validé (un avis retiré), puis de nouveau : nouvelle alerte.
    const undone = detectShareAlerts(first.state, { shared: [], owned: [owned(all.slice(1))] }, now);
    expect(undone.state.validated).toEqual([]);
    expect(detectShareAlerts(undone.state, { shared: [], owned: [owned(all)] }, now).alerts).toHaveLength(1);
  });
});
