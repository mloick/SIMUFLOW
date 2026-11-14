import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '../exemples';
import { validationOverview, type MemberReview, type ValidationMember } from '../validation';

const karim: ValidationMember = { id: 'k', name: 'Karim Benali', actor: 'Responsable' };
const ines: ValidationMember = { id: 'i', name: 'Inès Moreau', actor: 'Achats' };
const tom: ValidationMember = { id: 't', name: 'Tom Petit', actor: null };

const ok = (memberId: string, stepId: string): MemberReview => ({ memberId, stepId, status: 'valide', comment: null });

describe('suivi de la validation', () => {
  it('compte l’avancement de chaque membre sur sa partie', () => {
    const overview = validationOverview(
      demandeMateriel,
      [karim, ines, tom],
      [
        ok('k', 'validation'),
        ok('k', 'refus'),
        { memberId: 'i', stepId: 'commande', status: 'a_revoir', comment: 'Il faut deux devis' },
        ok('t', 'livraison'),
      ],
    );
    expect(overview.members.map((item) => [item.member.id, item.total, item.state])).toEqual([
      ['k', 2, 'termine'],
      ['i', 1, 'termine'],
      ['t', 4, 'en_cours'],
    ]);
    expect(overview.doneCount).toBe(2);
    expect(overview.toReviseCount).toBe(1);
    expect(overview.fullyValidated).toBe(false);
    const commande = overview.steps.find((item) => item.step.id === 'commande')!;
    expect(commande.toRevise).toEqual([{ member: ines, comment: 'Il faut deux devis' }]);
    const livraison = overview.steps.find((item) => item.step.id === 'livraison')!;
    expect(livraison.validatedBy).toEqual([tom]);
  });

  it('dit « entièrement validé » quand tout le monde a tout validé', () => {
    const overview = validationOverview(
      demandeMateriel,
      [karim, ines],
      [ok('k', 'validation'), ok('k', 'refus'), ok('i', 'commande')],
    );
    expect(overview.fullyValidated).toBe(true);
    expect(overview.members.every((item) => item.state === 'termine')).toBe(true);
  });

  it('n’est pas validé sans membre, ni avec une étape à revoir', () => {
    expect(validationOverview(demandeMateriel, [], []).fullyValidated).toBe(false);
    const overview = validationOverview(
      demandeMateriel,
      [ines],
      [{ memberId: 'i', stepId: 'commande', status: 'a_revoir', comment: 'Plutôt 2 JO' }],
    );
    expect(overview.doneCount).toBe(1);
    expect(overview.fullyValidated).toBe(false);
  });

  it('donne tout le process à un acteur qui n’a plus d’étape, et ignore les avis d’anciens membres', () => {
    const overview = validationOverview(
      demandeMateriel,
      [{ id: 'd', name: 'Ancien', actor: 'Direction' }],
      [ok('x', 'commande')],
    );
    expect(overview.members[0].total).toBe(4);
    expect(overview.members[0].state).toBe('pas_commence');
    expect(overview.steps.every((item) => item.validatedBy.length === 0)).toBe(true);
  });
});
