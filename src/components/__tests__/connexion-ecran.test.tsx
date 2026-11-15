/**
 * Test de composant : l'écran de connexion (refonte R5). Au premier lancement,
 * « Continuer sans compte » et une connexion réussie mènent à la présentation ;
 * ouvert depuis l'app, une croix le ferme. Le mot de passe s'affiche à la demande.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SignInScreen from '@/app/connexion';

const mockParams: { current: Record<string, string> } = { current: {} };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
const mockSignIn = jest.fn((_credentials: unknown) => Promise.resolve({ ok: true }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({
  signIn: (credentials: unknown) => mockSignIn(credentials),
  signUp: () => Promise.resolve({ ok: true, needsConfirmation: true }),
}));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams.current,
  Stack: { Screen: () => null },
}));

describe('Connexion', () => {
  beforeEach(() => {
    mockParams.current = {};
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockSignIn.mockClear();
  });

  it('premier lancement : « Continuer sans compte » ouvre la présentation', async () => {
    mockParams.current = { lancement: '1' };
    await render(<SignInScreen />);
    expect(screen.getByRole('header', { name: 'Connectez-vous' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer sans compte' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/bienvenue');
  });

  it('premier lancement : une connexion réussie ouvre la présentation', async () => {
    mockParams.current = { lancement: '1' };
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'camille.martin@exemple.fr');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'camille.martin@exemple.fr', password: 'motdepasse1' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/bienvenue');
  });

  it('depuis l’app : pas de « Continuer sans compte », la croix revient en arrière', async () => {
    await render(<SignInScreen />);
    expect(screen.queryByRole('button', { name: 'Continuer sans compte' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('« Pourquoi un compte ? » ouvre l’explication, l’œil affiche le mot de passe', async () => {
    await render(<SignInScreen />);
    expect(screen.queryByText(/vos process vous suivent/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Pourquoi un compte ?' }));
    expect(screen.getByText(/vos process vous suivent/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeOnTheScreen();
  });

  it('« Créer un compte » passe au formulaire de création', async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Créer un compte' }));
    expect(screen.getByRole('header', { name: 'Créez votre compte' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeOnTheScreen();
  });
});
