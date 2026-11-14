/**
 * Test d'écran : partager un process. Les membres se chargent, une invitation
 * pour un acteur s'ajoute à la liste, et une erreur du serveur s'affiche.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Member } from '@/backend/sharing';
import { SharePanel } from '@/components/share-panel';
import { demandeMateriel } from '@/domain/exemples';

const karim: Member = { id: 'b', firstName: 'Karim', lastName: 'Benali', username: 'karim.benali', actor: 'Achats' };

jest.mock('@/backend/sharing', () => {
  const actual = jest.requireActual<typeof import('@/backend/sharing')>('@/backend/sharing');
  return {
    ...actual,
    listMembers: jest.fn(async () => [karim]),
    inviteMember: jest.fn(async (_cloudId: string, who: string, actor: string | null) => {
      if (who === 'inconnu')
        throw new actual.SharingError('Aucun compte SimuFlow avec cet identifiant ou cette adresse.');
      return { id: 'c', firstName: 'Julie', lastName: 'Martin', username: 'julie.martin', actor };
    }),
    removeMember: jest.fn(),
  };
});

describe('SharePanel', () => {
  it('liste les membres et en invite un pour un acteur', async () => {
    const { inviteMember } = jest.requireMock<{ inviteMember: jest.Mock }>('@/backend/sharing');
    await render(<SharePanel process={demandeMateriel} cloudId="cloud-1" />);
    expect(await screen.findByText('Karim Benali')).toBeOnTheScreen();
    expect(screen.getByText('@karim.benali · Achats')).toBeOnTheScreen();
    expect(screen.getByText('Membres · 1')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Identifiant ou adresse e-mail'), 'inconnu');
    await fireEvent.press(screen.getByText('Inviter'));
    expect(await screen.findByText('Aucun compte SimuFlow avec cet identifiant ou cette adresse.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Identifiant ou adresse e-mail'), 'julie.martin');
    await fireEvent.press(screen.getByRole('radio', { name: 'Logistique' }));
    await fireEvent.press(screen.getByText('Inviter'));
    expect(inviteMember).toHaveBeenLastCalledWith('cloud-1', 'julie.martin', 'Logistique');
    expect(await screen.findByText('Invitation faite : Julie Martin, pour « Logistique ».')).toBeOnTheScreen();
    expect(screen.getByText('Membres · 2')).toBeOnTheScreen();
  });
});
