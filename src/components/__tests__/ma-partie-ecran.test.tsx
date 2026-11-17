/**
 * Test d'écran : un membre relit sa partie d'un process partagé. Il voit ses
 * étapes, en valide une, et « à revoir » demande un commentaire. Les étapes
 * des autres acteurs se lisent, sans avis à donner.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { SharedProcess } from '@/backend/shared';
import { ReviewPanel } from '@/components/review-panel';
import { demandeMateriel } from '@/domain/exemples';

const shared: SharedProcess = {
  process: { ...demandeMateriel, id: 'partage-cloud-1' },
  cloudId: 'cloud-1',
  actor: 'Responsable',
  ownerName: 'Julie Martin',
  updatedAt: '2026-11-14T10:00:00Z',
};

jest.mock('@/backend/shared', () => ({
  listMyReviews: jest.fn(async () => [{ stepId: 'refus', status: 'a_revoir', comment: 'Plutôt 2 JO' }]),
  saveReview: jest.fn(async () => undefined),
  removeReview: jest.fn(async () => undefined),
}));

describe('ReviewPanel', () => {
  it('montre ma partie, valide une étape et demande un commentaire pour « à revoir »', async () => {
    const { saveReview } = jest.requireMock<{ saveReview: jest.Mock }>('@/backend/shared');
    await render(<ReviewPanel shared={shared} />);

    expect(await screen.findByText('« Plutôt 2 JO »')).toBeOnTheScreen();
    expect(screen.getByText('Julie Martin vous confie « Responsable » : 2 étapes à relire.')).toBeOnTheScreen();
    expect(screen.getByText('0 validée · 1 à revoir · 1 à relire')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Ma partie · 2' })).toBeOnTheScreen();
    expect(screen.queryByText('Passer la commande')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Valider l’étape 2'));
    expect(saveReview).toHaveBeenLastCalledWith('cloud-1', { stepId: 'validation', status: 'valide', comment: null });
    expect(await screen.findByText('Merci : votre partie est relue, avec 1 étape à revoir.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Changer mon avis sur l’étape 2'));
    await fireEvent.press(screen.getByRole('radio', { name: 'À revoir' }));
    await fireEvent.press(screen.getByText('Enregistrer mon avis'));
    expect(screen.getByText('Dites ce qui est à revoir dans cette étape.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Commentaire sur l’étape 2'), 'Le devis d’avant n’a pas le montant.');
    await fireEvent.press(screen.getByText('Enregistrer mon avis'));
    expect(saveReview).toHaveBeenLastCalledWith('cloud-1', {
      stepId: 'validation',
      status: 'a_revoir',
      comment: 'Le devis d’avant n’a pas le montant.',
    });

    // Tout le process : les étapes des autres acteurs se lisent, sans avis à donner.
    await fireEvent.press(screen.getByRole('radio', { name: 'Tout le process · 4' }));
    expect(screen.getByText('Passer la commande')).toBeOnTheScreen();
    expect(screen.getByText(/Les étapes des autres acteurs sont en lecture seule/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Valider l’étape 3')).toBeNull();
    expect(screen.queryByLabelText('Signaler l’étape 3 à revoir')).toBeNull();
    expect(screen.getAllByText('Lecture seule')).toHaveLength(2);
  });
});
