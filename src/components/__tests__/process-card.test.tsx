/**
 * Test de composant : la carte d'un process dans la liste. Elle résume le
 * process (étapes, décisions, acteurs, diagnostic) et ouvre son détail.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ProcessCard } from '@/components/process-card';
import { summarize } from '@/domain';
import { copie, demandeMateriel } from '@/domain/exemples';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('ProcessCard', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('résume le process : nom, étapes, décisions, acteurs et diagnostic', async () => {
    await render(<ProcessCard process={demandeMateriel} summary={summarize(demandeMateriel)} />);

    expect(screen.getByText('Demande de matériel')).toBeOnTheScreen();
    expect(screen.getByText('6 étapes · 1 décision · 4 acteurs')).toBeOnTheScreen();
    expect(screen.getByText('Aucune anomalie')).toBeOnTheScreen();
  });

  it('signale les anomalies du process', async () => {
    // Une étape que rien ne relie : le diagnostic la signale par un avertissement.
    const process = copie();
    process.steps.push({ id: 'isolee', kind: 'task', title: 'Archiver la demande' });
    await render(<ProcessCard process={process} summary={summarize(process)} />);

    expect(screen.getByText('1 avertissement')).toBeOnTheScreen();
    expect(screen.queryByText('Aucune anomalie')).not.toBeOnTheScreen();
  });

  it('ouvre le détail du process quand on la touche', async () => {
    await render(<ProcessCard process={demandeMateriel} summary={summarize(demandeMateriel)} />);

    await fireEvent.press(screen.getByRole('button', { name: /Demande de matériel/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/process/[id]', params: { id: 'demande-materiel' } });
  });
});
