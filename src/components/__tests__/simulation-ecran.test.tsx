/**
 * Test d'écran : la simulation (refonte R9 à R11). Pas à pas, la carte de
 * l'étape en bas suit le parcours : étape suivante, choix d'une décision,
 * retour, puis la fin.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SimulationScreen from '@/app/simulation/[id]';
import { demoProcesses } from '@/data/demo-processes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({
    id: jest.requireActual<typeof import('@/data/demo-processes')>('@/data/demo-processes').demoProcesses[0].id,
  }),
  Stack: { Screen: ({ options }: { options: { headerRight?: () => ReactNode } }) => options.headerRight?.() ?? null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const process = demoProcesses[0];

describe('Simulation', () => {
  it('avance pas à pas, revient en arrière et choisit à une décision', async () => {
    await render(<SimulationScreen />);
    expect(screen.getAllByText(process.steps[0].title).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: /^Étape suivante/ }));
    expect(screen.getAllByText(process.steps[1].title).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Revenir en arrière' }));
    expect(screen.getAllByText(process.steps[0].title).length).toBeGreaterThan(0);
  });

  it('va jusqu’à la fin en choisissant « oui »', async () => {
    await render(<SimulationScreen />);
    for (let i = 0; i < 12 && !screen.queryByText('Fin atteinte'); i++) {
      const next = screen.queryByRole('button', { name: /^Étape suivante/ });
      if (next) await fireEvent.press(next);
      else await fireEvent.press(screen.getAllByRole('button', { name: /^Choisir oui/ })[0]);
    }
    expect(screen.getByText('Fin atteinte')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Recommencer/ })).toBeOnTheScreen();
  });
});
