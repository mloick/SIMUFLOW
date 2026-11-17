/**
 * Test de composant : les liens d'acteur côté propriétaire. Un lien affiche
 * sa date de fin ; un lien expiré ne s'envoie plus, il se prolonge.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActorLinks } from '../actor-links';

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

jest.mock('@/backend/links', () => ({
  ...jest.requireActual<typeof import('@/backend/links')>('@/backend/links'),
  listActorLinks: jest.fn(async () => [
    {
      id: 'l1',
      processId: 'p',
      actor: 'Achats',
      token: 'a'.repeat(64),
      expiresAt: inDays(-2),
    },
    {
      id: 'l2',
      processId: 'p',
      actor: 'Finance',
      token: 'b'.repeat(64),
      expiresAt: inDays(20),
    },
  ]),
  extendActorLink: jest.fn(async () => inDays(30)),
}));
jest.mock('@/backend/client', () => ({ supabase: {} }));

describe('liens d’acteur du propriétaire', () => {
  it('montre la date de fin, et prolonge un lien expiré', async () => {
    const { extendActorLink } = jest.requireMock<{
      extendActorLink: jest.Mock;
    }>('@/backend/links');
    await render(<ActorLinks cloudId="p" processName="Demande de matériel" actors={['Achats', 'Finance']} />);

    expect(await screen.findByText(/^Expiré le /)).toBeOnTheScreen();
    expect(screen.getAllByText(/^Valable jusqu’au /)).toHaveLength(1);
    // Le lien expiré ne s'envoie plus ; le lien valable encore longtemps n'a pas « Prolonger ».
    expect(screen.queryByLabelText('Envoyer le lien de Achats')).toBeNull();
    expect(screen.getByLabelText('Envoyer le lien de Finance')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Prolonger de 30 jours le lien de Finance')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Prolonger de 30 jours le lien de Achats'));
    expect(extendActorLink).toHaveBeenCalledWith('l1');
    expect(await screen.findByText('Lien de « Achats » prolongé de 30 jours.')).toBeOnTheScreen();
    expect(screen.queryByText(/^Expiré le /)).toBeNull();
    expect(screen.getAllByText(/^Valable jusqu’au /)).toHaveLength(2);
    expect(screen.getByLabelText('Envoyer le lien de Achats')).toBeOnTheScreen();
  });
});
