/**
 * Test d'écran : « Partager par lien ». Le formulaire affiché part avec son
 * workflow dans un lien de consultation ; le lien créé s'affiche et rejoint
 * la liste. Sans compte, l'écran demande de se connecter.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ShareViewLinkScreen from '@/app/partager-lien';
import { showForm } from '@/data/form-store';
import { demandeMateriel } from '@/domain/exemples';
import type { FormTemplate } from '@/import/tableau';

let mockSession: { user: { id: string } } | null = { user: { id: 'a' } };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ source: 'form' }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: () => {} }));
jest.mock('@/backend/auth', () => ({ useSession: () => mockSession }));
jest.mock('@/backend/view-links', () => {
  const actual = jest.requireActual<typeof import('@/backend/view-links')>('@/backend/view-links');
  return {
    ...actual,
    listViewLinks: jest.fn(async () => []),
    createViewLink: jest.fn(async (input: { title: string }) => ({
      id: 'l1',
      kind: 'form_workflow',
      title: input.title,
      note: null,
      token: 'abc123',
      createdAt: '2026-11-26T10:00:00Z',
      expiresAt: '2026-12-26T10:00:00Z',
    })),
  };
});

const form: FormTemplate = {
  name: 'Demande de matériel',
  description: null,
  ticketType: null,
  keywords: [],
  questions: [],
  tasks: [],
  assignmentGroup: null,
  summary: null,
  warnings: [],
};

describe('Partager par lien', () => {
  it('crée le lien du formulaire et de son workflow, puis l’affiche', async () => {
    const { createViewLink } = jest.requireMock<{ createViewLink: jest.Mock }>('@/backend/view-links');
    const workflow = { kind: 'process' as const, source: 'd.drawio', process: demandeMateriel };
    showForm(form, { source: 'f.xlsx', workflow });
    await render(<ShareViewLinkScreen />);

    expect(screen.getByText('Formulaire et workflow')).toBeOnTheScreen();
    expect(screen.getByText(/Toute personne qui a le lien voit ce contenu pendant 30 jours/)).toBeOnTheScreen();
    expect(await screen.findByText('Aucun lien pour l’instant.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Votre mot (facultatif)'), 'Regardez l’étape 2');
    await fireEvent.press(screen.getByText('Créer le lien'));

    expect(createViewLink).toHaveBeenLastCalledWith({ title: 'Demande de matériel', note: 'Regardez l’étape 2', form, workflow });
    expect(await screen.findByText('Lien créé')).toBeOnTheScreen();
    expect(screen.getByText('https://mloick.github.io/SIMUFLOW/app/voir/abc123')).toBeOnTheScreen();
  });

  it('sans compte, demande de se connecter', async () => {
    mockSession = null;
    await render(<ShareViewLinkScreen />);
    expect(screen.getByText('Connectez-vous pour créer un lien : il est gardé sur votre compte.')).toBeOnTheScreen();
  });
});
