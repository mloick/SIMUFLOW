/**
 * Test de composant : l'équipe d'un projet. Le chef voit l'équipe, invite un
 * collaborateur, puis le nomme chef de projet ; un collaborateur ne gère rien.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TeamPanel } from '@/components/team-panel';
import type { TeamMember } from '@/backend/project-team';

const mockTeam: TeamMember[] = [
  { id: 'a', firstName: 'Camille', lastName: 'Durand', username: 'camille', role: 'chef' },
  { id: 'b', firstName: 'Julie', lastName: 'Martin', username: 'julie.martin', role: 'collaborateur' },
];
const mockInvite = jest.fn(async (_project: string, who: string): Promise<TeamMember> => {
  if (who === 'inconnu') throw new Error('Aucun compte SimuFlow avec cet identifiant ou cette adresse.');
  return { id: 'd', firstName: 'Hugo', lastName: 'Petit', username: 'hugo', role: 'collaborateur' };
});
const mockTransfer = jest.fn(async () => {});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({ useSession: () => ({ user: { id: 'a' } }) }));
jest.mock('@/data/cloud-sync', () => ({ syncNow: jest.fn() }));
jest.mock('@/data/project-store', () => ({ isProjectSynced: () => true, useProjects: () => [] }));
jest.mock('@/utils/confirm', () => ({
  confirmAction: (_title: string, _message: string, _button: string, action: () => void) => action(),
}));
jest.mock('@/backend/project-team', () => {
  const actual = jest.requireActual<typeof import('@/backend/project-team')>('@/backend/project-team');
  return {
    ...actual,
    listTeam: async () => [...mockTeam],
    inviteToProject: (project: string, who: string) => mockInvite(project, who),
    transferChef: () => mockTransfer(),
    removeFromTeam: async () => {},
  };
});

describe('Équipe du projet', () => {
  beforeEach(() => {
    mockInvite.mockClear();
    mockTransfer.mockClear();
  });

  it('le chef invite un collaborateur, puis le nomme chef de projet', async () => {
    await render(<TeamPanel projectId="p1" role="chef" />);
    expect(await screen.findByText('Camille Durand (vous)')).toBeTruthy();
    expect(screen.getByText('★ Chef')).toBeTruthy();
    expect(screen.getByText('Équipe · 2')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Inviter dans l’équipe'), 'inconnu');
    await fireEvent.press(screen.getByText('Inviter'));
    expect(await screen.findByText('Aucun compte SimuFlow avec cet identifiant ou cette adresse.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Inviter dans l’équipe'), 'hugo');
    await fireEvent.press(screen.getByText('Inviter'));
    expect(await screen.findByText('Hugo Petit fait partie de l’équipe.')).toBeTruthy();
    expect(mockInvite).toHaveBeenLastCalledWith('p1', 'hugo');

    await fireEvent.press(screen.getByLabelText('Actions pour Julie Martin'));
    await fireEvent.press(screen.getByText('Nommer chef de projet'));
    expect(mockTransfer).toHaveBeenCalled();
    expect(await screen.findByText('Julie Martin est maintenant chef de projet.')).toBeTruthy();
  });

  it('un collaborateur voit l’équipe sans pouvoir la gérer', async () => {
    await render(<TeamPanel projectId="p1" role="collaborateur" />);
    expect(await screen.findByText('Julie Martin')).toBeTruthy();
    expect(screen.queryByLabelText('Inviter dans l’équipe')).toBeNull();
    expect(screen.queryByLabelText('Actions pour Julie Martin')).toBeNull();
  });
});
