/**
 * Test d'écran : changer la langue redessine l'écran tout de suite, sans
 * relancer l'app (ici l'écran de connexion, et son message d'erreur).
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SignInScreen from '@/app/connexion';
import { setLanguageSetting } from '@/i18n';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/backend/auth', () => ({ signIn: jest.fn(), signUp: jest.fn(), requestPasswordReset: jest.fn() }));

afterEach(() => setLanguageSetting('auto'));

describe('langue de l’app', () => {
  it('passe l’écran de connexion en anglais, puis le remet en français', async () => {
    await render(<SignInScreen />);
    expect(screen.getByText('Pas encore de compte ?')).toBeOnTheScreen();

    await act(() => setLanguageSetting('en'));
    expect(screen.getByText('No account yet?')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByText('Sign in')[0]);
    expect(screen.getByText('Enter your email address.')).toBeOnTheScreen();

    await act(() => setLanguageSetting('fr'));
    expect(screen.getByText('Pas encore de compte ?')).toBeOnTheScreen();
  });
});
