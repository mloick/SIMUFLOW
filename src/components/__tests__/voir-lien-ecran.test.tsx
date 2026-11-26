/**
 * Test d'écran : la page d'un lien de consultation, sans compte. Un
 * formulaire et son workflow : on remplit, on envoie, puis on voit le workflow
 * choisi par les réponses. Un workflow seul s'ouvre directement sur la
 * simulation, avec le guide. Un lien expiré le dit.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ViewLinkScreen from '@/app/voir/[token]';
import type { ViewLinkView } from '@/backend/view-links';
import { demandeMateriel } from '@/domain/exemples';
import { readFormTemplate, readTableFile, workbookToSituations } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

let mockToken = 'formulaire';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ token: mockToken }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
// Le simulateur a son propre test : ici, on vérifie seulement quel process il reçoit, sans export.
jest.mock('@/components/simulator', () => ({
  Simulator: ({ process, exportable }: { process: { name: string }; exportable?: boolean }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`Simulation : ${process.name}${exportable === false ? ' (sans export)' : ''}`}</Text>;
  },
}));

const linked = readTableFile('formulaire-et-workflow.xlsx', lireExemple('formulaire-et-workflow.xlsx'));
const form = readFormTemplate(linked)!;
const { situations } = workbookToSituations(linked);

const base = { title: 'Achat de fournitures', ownerName: 'Inès Moreau', expiresAt: '2026-12-26T10:00:00Z' };
const mockViews: Record<string, ViewLinkView> = {
  formulaire: {
    ...base,
    kind: 'form_workflow',
    note: 'Choisissez « Cas 3 » pour voir le cas le plus long.',
    form: { ...form, questions: form.questions.slice(1, 3) },
    workflow: { kind: 'situations', source: 'f.xlsx', situations },
  },
  workflow: {
    ...base,
    kind: 'workflow',
    note: null,
    form: null,
    workflow: { kind: 'process', source: 'd.drawio', process: demandeMateriel },
  },
};

jest.mock('@/backend/view-links', () => ({
  openViewLink: jest.fn(async (token: string) => {
    if (token === 'expire') throw new Error('Ce lien a expiré. Demandez à qui vous l’a envoyé de le prolonger.');
    return mockViews[token];
  }),
}));

describe('page d’un lien de consultation', () => {
  it('formulaire et workflow : remplir, envoyer, puis voir le workflow choisi', async () => {
    mockToken = 'formulaire';
    await render(<ViewLinkScreen />);

    expect(await screen.findByText('Comment lire cette page')).toBeOnTheScreen();
    expect(screen.getByText('Choisissez « Cas 3 » pour voir le cas le plus long.')).toBeOnTheScreen();
    expect(screen.getByText(/Envoyé par Inès Moreau/)).toBeOnTheScreen();
    expect(
      screen.getByText('« Envoyer la demande » vérifie vos réponses, puis montre le workflow qui suit la demande.'),
    ).toBeOnTheScreen();

    // Une réponse manque : la page arrête l'envoi, comme l'app.
    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText(/à corriger avant l’envoi/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Situation'));
    await fireEvent.press(screen.getByText('Cas 3'));
    await fireEvent.press(screen.getByText('Oui'));
    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText('Demande prête')).toBeOnTheScreen();
    expect(screen.getByText('Famille X · Cas 3')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Voir le workflow qui suit'));
    expect(screen.getByText('Simulation : Famille X · Cas 3 (sans export)')).toBeOnTheScreen();
    // Retour au formulaire depuis la simulation : un nouvel essai.
    await fireEvent.press(screen.getByText('Revenir au formulaire'));
    expect(screen.getByText('Envoyer la demande')).toBeOnTheScreen();
  });

  it('workflow seul : la simulation s’ouvre tout de suite, avec le guide repliable', async () => {
    mockToken = 'workflow';
    await render(<ViewLinkScreen />);

    expect(await screen.findByText(`Simulation : ${demandeMateriel.name} (sans export)`)).toBeOnTheScreen();
    expect(screen.queryByText(/Le schéma montre tout le workflow/)).toBeNull();
    await fireEvent.press(screen.getByText('Voir le guide'));
    expect(screen.getByText(/Le schéma montre tout le workflow/)).toBeOnTheScreen();
  });

  it('dit qu’un lien a expiré', async () => {
    mockToken = 'expire';
    await render(<ViewLinkScreen />);
    expect(await screen.findByText('Lien expiré')).toBeOnTheScreen();
  });
});
