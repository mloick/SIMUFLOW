/**
 * Test de composant : la page Profil (refonte R4). Sans compte, puis connecté :
 * la bannière, les chiffres, la synchronisation, et la suppression demandée deux fois.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileScreen from '@/app/profil';

const mockSession: { current: unknown } = { current: null };
const mockDeleteAccount = jest.fn(() => Promise.resolve({ ok: true }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({
  useSession: () => mockSession.current,
  signOut: () => Promise.resolve({ ok: true }),
  deleteAccount: () => mockDeleteAccount(),
}));
jest.mock('@/data/profile-store', () => ({
  useMyProfile: () =>
    mockSession.current
      ? {
          status: 'ready',
          profile: { firstName: 'Camille', lastName: 'Martin', username: 'camille', role: 'chef_de_projet' },
        }
      : { status: 'none' },
}));
jest.mock('@/data/cloud-sync', () => ({
  syncNow: jest.fn(),
  useSyncStatus: () => ({ state: 'idle' }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
}));

describe('Profil', () => {
  beforeEach(() => {
    mockSession.current = null;
    mockDeleteAccount.mockClear();
  });

  it('sans compte : la bannière, les chiffres et l’invitation à se connecter', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByRole('header', { name: /Sans compte/ })).toBeOnTheScreen();
    expect(screen.getByLabelText('0 process à vous, 0 partagés avec vous, 0 formulaires gardés')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).toBeNull();
  });

  it('connecté : le nom, l’identifiant et le rôle, puis Modifier', async () => {
    mockSession.current = { user: { id: 'u1', email: 'camille.martin@exemple.fr' } };
    await render(<ProfileScreen />);
    expect(screen.getByRole('header', { name: 'Camille Martin, @camille · Chef de projet' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Modifier mon profil' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Synchroniser maintenant' })).toBeOnTheScreen();
  });

  it('demande deux fois avant de supprimer le compte', async () => {
    mockSession.current = { user: { id: 'u1', email: 'camille.martin@exemple.fr' } };
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer définitivement mon compte' }));
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
