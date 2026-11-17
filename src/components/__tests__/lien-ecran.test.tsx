/**
 * Test d'écran : la page d'un lien d'acteur, sans compte. La personne
 * confirme son nom, puis valide une étape : l'avis part avec son nom.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import LinkScreen from '@/app/lien/[token]';

let mockToken = 'jeton-1';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ token: mockToken }),
}));

jest.mock('@/backend/links', () => ({
  openLink: jest.fn(async (token: string) => {
    if (token === 'jeton-expire') throw new Error('Ce lien a expiré. Demandez à qui vous l’a envoyé de le prolonger.');
    if (token !== 'jeton-1') throw new Error('Ce lien n’existe pas ou a été retiré.');
    return {
      process: jest.requireActual<typeof import('@/domain/exemples')>('@/domain/exemples').demandeMateriel,
      actor: 'Achats',
      ownerName: 'Julie Martin',
      reviews: [],
      reviewerName: null,
    };
  }),
  reviewByLink: jest.fn(async () => undefined),
  unreviewByLink: jest.fn(async () => undefined),
}));

describe('page d’un lien d’acteur', () => {
  it('demande le nom, puis enregistre l’avis avec ce nom', async () => {
    const { reviewByLink } = jest.requireMock<{ reviewByLink: jest.Mock }>('@/backend/links');
    await render(<LinkScreen />);

    expect(await screen.findByText('Vous êtes « Achats » ? Écrivez votre nom pour le confirmer.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Votre nom'), '  Karim Benali ');
    await fireEvent.press(screen.getByText('C’est moi, je relis ma partie'));

    expect(await screen.findByText('Julie Martin vous confie « Achats » : 1 étape à relire.')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Julie Martin voit vos avis, signés « Karim Benali ». Vous pouvez les changer tant que le lien est valable.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Valider l’étape 3'));
    expect(reviewByLink).toHaveBeenLastCalledWith('jeton-1', 'Karim Benali', {
      stepId: 'commande',
      status: 'valide',
      comment: null,
    });
    expect(await screen.findByText('Merci : votre partie est relue et validée.')).toBeOnTheScreen();
  });

  it('dit qu’un lien a expiré, au lieu de « introuvable »', async () => {
    mockToken = 'jeton-expire';
    await render(<LinkScreen />);
    expect(await screen.findByText('Lien expiré')).toBeOnTheScreen();
    expect(screen.getByText('Ce lien a expiré. Demandez à qui vous l’a envoyé de le prolonger.')).toBeOnTheScreen();
    mockToken = 'jeton-1';
  });
});
