/**
 * Test de composant : l'accueil (onglet Process). On le lit et on le touche
 * comme un utilisateur : bonjour, filtres, carte « Reprendre », cloche et
 * bouton « Nouveau ».
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ProcessListScreen from '@/app/(tabs)/index';
import { demoProcesses } from '@/data/demo-processes';
import { setExamplesShown } from '@/data/examples-setting';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({ useSession: () => null }));
jest.mock('@/data/profile-store', () => ({ useMyProfile: () => ({ status: 'loading', reload: () => {} }) }));
jest.mock('@/data/welcome-setting', () => ({ useWelcomeSeen: () => true }));
jest.mock('@/data/shared-store', () => ({ useSharedProcesses: () => [] }));

// Deux process à moi : un sans anomalie, un avec une étape isolée (à corriger), plus un exemple.
function mockProcesses() {
  const { copie, demandeMateriel } = jest.requireActual<typeof import('@/domain/exemples')>('@/domain/exemples');
  const { demoProcesses } = jest.requireActual<typeof import('@/data/demo-processes')>('@/data/demo-processes');
  const aCorriger = { ...copie(), id: 'a-corriger', name: 'Commande de badges' };
  aCorriger.steps = [...aCorriger.steps, { id: 'isolee', kind: 'task', title: 'Archiver la demande' }];
  return [demandeMateriel, aCorriger, demoProcesses[0]];
}
// L'état de la liste, changé par chaque test (par défaut : prête, en ligne).
let mockList: Record<string, unknown> | null = null;
const mockReload = jest.fn();
jest.mock('@/data/process-list', () => ({
  useProcessList: () => ({
    status: 'ready',
    processes: mockProcesses(),
    offline: false,
    ...mockList,
    reload: mockReload,
  }),
}));
// Une demande suivie en vrai, pas terminée, à la première étape de « Demande de matériel ».
jest.mock('@/data/tracking-store', () => ({
  useTrackings: () => [
    {
      id: 'suivi-1',
      processId: 'demande-materiel',
      label: 'Demande du 14/11',
      startedAt: '2026-11-14T09:00:00.000Z',
      steps: [{ stepId: 'demande', startedAt: '2026-11-14T09:00:00.000Z' }],
    },
  ],
}));
const exemple = demoProcesses[0];

describe('Accueil', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    mockReload.mockClear();
    mockList = null;
  });

  it('dit bonjour, montre le titre et les filtres avec leur nombre', async () => {
    await render(<ProcessListScreen />);
    expect(screen.getByRole('button', { name: 'Bonjour Sans compte' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Vos process' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tous, 3' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'À corriger, 1' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Exemples, 1' })).toBeOnTheScreen();
    // Rien de partagé : pas de filtre « Partagés ».
    expect(screen.queryByRole('button', { name: /^Partagés/ })).not.toBeOnTheScreen();
  });

  it('filtre les process à corriger', async () => {
    await render(<ProcessListScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'À corriger, 1' }));
    expect(screen.getByText('Commande de badges')).toBeOnTheScreen();
    expect(screen.queryByText('Demande de matériel')).not.toBeOnTheScreen();
    expect(screen.queryByText(exemple.name)).not.toBeOnTheScreen();
  });

  it('reprend la demande suivie en cours', async () => {
    await render(<ProcessListScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Reprendre\. Demande de matériel/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/suivi/[id]', params: { id: 'suivi-1' } });
  });

  it('ouvre les alertes et le nouvel import', async () => {
    await render(<ProcessListScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Alertes du partage' }));
    expect(router.push).toHaveBeenCalledWith('/alertes');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un process' }));
    expect(router.push).toHaveBeenCalledWith('/import');
  });

  it('montre le squelette pendant le chargement', async () => {
    mockList = { status: 'loading' };
    await render(<ProcessListScreen />);
    expect(screen.getByLabelText('Chargement des process')).toBeOnTheScreen();
  });

  it('propose « Réessayer » quand le chargement échoue', async () => {
    mockList = { status: 'error' };
    await render(<ProcessListScreen />);
    expect(screen.getByRole('header', { name: 'Impossible de charger vos process' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('liste vide : ajoute un process ou réaffiche les exemples', async () => {
    mockList = { processes: [] };
    setExamplesShown(false);
    await render(<ProcessListScreen />);
    expect(screen.getByRole('header', { name: 'Aucun process pour l’instant' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir les exemples' }));
    expect(globalThis.localStorage.getItem('simuflow.exemples')).toBe('on');
  });

  it('hors ligne : un bandeau, et les process restent là', async () => {
    mockList = { offline: true };
    await render(<ProcessListScreen />);
    expect(screen.getByText('Hors ligne · vos process restent disponibles')).toBeOnTheScreen();
    expect(screen.getByText('Commande de badges')).toBeOnTheScreen();
  });
});
