/**
 * Test d'écran : le détail d'un process (refonte R8). On voit les chiffres
 * clés, on lance la simulation, on ouvre les étapes et le menu « … ».
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import ProcessDetailScreen from '@/app/process/[id]';
import { demoProcesses } from '@/data/demo-processes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({
    id: jest.requireActual<typeof import('@/data/demo-processes')>('@/data/demo-processes').demoProcesses[0].id,
  }),
  // Le bouton « … » de l'en-tête est rendu dans l'écran, pour pouvoir le toucher.
  Stack: { Screen: ({ options }: { options: { headerRight?: () => ReactNode } }) => options.headerRight?.() ?? null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/auth', () => ({ useSession: () => null }));
jest.mock('@/data/tracking-store', () => ({ useTrackings: () => [], saveTracking: jest.fn() }));

const process = demoProcesses[0];

describe('Détail d’un process', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('montre le nom, les chiffres clés et lance la simulation', async () => {
    await render(<ProcessDetailScreen />);
    expect(screen.getByText(process.name)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Lancer la simulation' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/simulation/[id]', params: { id: process.id } });
  });

  it('ouvre l’export depuis les actions rapides', async () => {
    await render(<ProcessDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /Exporter/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/export/[id]', params: { id: process.id } });
  });

  it('déplie les étapes', async () => {
    await render(<ProcessDetailScreen />);
    expect(screen.queryByText(process.steps[1].title)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Étapes/ }));
    expect(screen.getByText(process.steps[1].title)).toBeOnTheScreen();
  });

  it('ouvre le menu « … » avec l’export complet', async () => {
    await render(<ProcessDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Plus d’actions' }));
    expect(screen.getByText('Exporter en PDF, draw.io, BPMN ou JSON')).toBeOnTheScreen();
  });
});
