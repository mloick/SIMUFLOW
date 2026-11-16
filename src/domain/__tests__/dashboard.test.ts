import { describe, expect, it } from '@jest/globals';

import { projectDashboard } from '../dashboard';
import { demandeMateriel } from '../exemples';
import type { MemberReview, ValidationMember } from '../validation';

const karim: ValidationMember = { id: 'k', name: 'Karim Benali', actor: 'Responsable' };
const ines: ValidationMember = { id: 'i', name: 'Inès Moreau', actor: 'Achats' };

const ok = (memberId: string, stepId: string): MemberReview => ({ memberId, stepId, status: 'valide', comment: null });

const validated = { ...demandeMateriel, id: 'p-valide', name: 'Validé' };
const inReview = { ...demandeMateriel, id: 'p-relecture', name: 'En relecture' };
const toRevise = { ...demandeMateriel, id: 'p-revoir', name: 'À revoir' };
const notShared = { ...demandeMateriel, id: 'p-seul', name: 'Pas partagé' };

describe('tableau de bord d’un projet', () => {
  const dashboard = projectDashboard([
    { process: validated, members: [karim], reviews: [ok('k', 'validation'), ok('k', 'refus')] },
    { process: inReview, members: [karim, ines], reviews: [ok('k', 'validation')] },
    { process: notShared, members: [], reviews: [] },
    {
      process: toRevise,
      members: [ines],
      reviews: [{ memberId: 'i', stepId: 'commande', status: 'a_revoir', comment: 'Il faut deux devis' }],
    },
  ]);

  it('donne l’état de chaque process, ceux qui demandent une action d’abord', () => {
    expect(dashboard.processes.map((item) => [item.process.id, item.status])).toEqual([
      ['p-revoir', 'a_revoir'],
      ['p-relecture', 'en_relecture'],
      ['p-seul', 'pas_partage'],
      ['p-valide', 'valide'],
    ]);
    expect(dashboard.counts).toEqual({ a_revoir: 1, en_relecture: 1, pas_partage: 1, valide: 1 });
  });

  it('compte les relectures faites sur toutes celles attendues', () => {
    // Validé 2/2, En relecture 1/3 (Karim 1/2, Inès 0/1), À revoir 1/1, Pas partagé 0/0.
    expect([dashboard.reviewed, dashboard.expected, dashboard.percent]).toEqual([4, 6, 67]);
  });

  it('liste les étapes signalées avec leur commentaire', () => {
    expect(dashboard.issues.map((item) => [item.process.id, item.step.id, item.member.id, item.comment])).toEqual([
      ['p-revoir', 'commande', 'i', 'Il faut deux devis'],
    ]);
  });

  it('dit qui n’a pas fini, une seule fois par personne', () => {
    expect(dashboard.waitingOn.map((member) => member.id)).toEqual(['k', 'i']);
  });

  it('reste à 0 % pour un projet vide', () => {
    const empty = projectDashboard([]);
    expect([empty.percent, empty.processes.length, empty.issues.length]).toEqual([0, 0, 0]);
  });
});
