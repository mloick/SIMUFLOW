/**
 * Test de composant : l'onglet Réglages. On le lit et on le touche comme un
 * utilisateur : la carte du profil, la palette, les exemples et le bouton « ? ».
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/reglages';
import { getPalette, setPalette } from '@/data/palette-setting';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({ useSession: () => null }));
jest.mock('@/backend/health', () => ({ checkServer: () => Promise.resolve('ok') }));
jest.mock('@/notifications/notifications', () => ({
  cancelAllNotifications: jest.fn(),
  getNotificationPermission: () => Promise.resolve('unavailable'),
  requestNotificationPermission: jest.fn(),
  sendTestNotification: jest.fn(),
  TEST_DELAY_SECONDS: 5,
}));

describe('Réglages', () => {
  it('propose de se connecter, puis montre chaque groupe', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeOnTheScreen();
    for (const title of ['Apparence', 'Langue', 'Notifications', 'Liste des process', 'À propos']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(await screen.findByText('Joignable')).toBeOnTheScreen();
  });

  it('change de palette en touchant sa pastille', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Palette Menthe' }));
    expect(getPalette()).toBe('menthe');
    expect(screen.getByRole('radio', { name: 'Palette Menthe' })).toBeChecked();
    setPalette('ocean');
  });

  it('explique un réglage avec le bouton « ? »', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Expliquer : Afficher les exemples' }));
    expect(screen.getByText('Quatre process fictifs fournis avec l’app, en bas de la liste.')).toBeOnTheScreen();
  });
});
