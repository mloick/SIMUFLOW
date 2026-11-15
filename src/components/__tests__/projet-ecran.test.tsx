/**
 * Test de composant : les écrans d'un projet. Créer un projet, voir ses
 * process, y ranger un process, puis le supprimer (ses process restent).
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AddToProjectScreen from '@/app/projet/ajouter/[id]';
import ProjectFormScreen from '@/app/projet/nouveau';
import ProjectScreen from '@/app/projet/[id]';
import { addImportedProcess, getProcess, setImportEntries } from '@/data/process-store';
import { getProject, removeProject } from '@/data/project-store';

const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: () => {} }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  // Le bouton « … » de l'en-tête est affiché pour pouvoir le toucher.
  Stack: { Screen: ({ options }: { options?: { headerRight?: () => unknown } }) => options?.headerRight?.() ?? null },
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('@/utils/confirm', () => ({
  confirmAction: (_title: string, _message: string, _button: string, action: () => void) => action(),
}));

const process = (id: string, name: string) => ({
  id,
  name,
  steps: [{ id: 's1', title: 'Départ', kind: 'start' as const }],
  links: [],
});

/** Les projets gardés sur le téléphone, du plus récent au plus ancien. */
const savedProjects = (): { project: { id: string; name: string } }[] =>
  JSON.parse(globalThis.localStorage?.getItem('simuflow.projets') ?? '[]');

describe('Projets', () => {
  beforeEach(() => {
    jest.mocked(router.replace).mockClear();
    setImportEntries([]);
    savedProjects().forEach(({ project }) => removeProject(project.id));
  });

  it('crée un projet, y range un process, puis le supprime sans toucher au process', async () => {
    addImportedProcess(process('a', 'Ouvrir un ticket'));
    addImportedProcess(process('b', 'Clôturer une demande'));

    mockParams.current = {};
    await render(<ProjectFormScreen />);
    await fireEvent.press(screen.getByText('Créer le projet'));
    expect(screen.getByText('Donnez un nom au projet.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nom du projet'), 'Migration du support');
    await fireEvent.press(screen.getByText('Créer le projet'));
    const project = savedProjects()[0].project;
    expect(project.name).toBe('Migration du support');
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/projet/[id]', params: { id: project.id } });

    mockParams.current = { id: project.id };
    await render(<AddToProjectScreen />);
    await fireEvent.press(screen.getByLabelText('Ouvrir un ticket'));
    expect(getProcess('a')?.projectId).toBe(project.id);
    expect(screen.getByText('Dans ce projet')).toBeTruthy();

    await render(<ProjectScreen />);
    expect(screen.getByText('Process du projet · 1')).toBeTruthy();
    expect(screen.getByText('Ouvrir un ticket')).toBeTruthy();
    expect(screen.queryByText('Clôturer une demande')).toBeNull();
    expect(screen.getByText('Chef de projet : vous')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Actions du projet'));
    await fireEvent.press(screen.getByText('Supprimer le projet'));
    expect(getProject(project.id)).toBeUndefined();
    expect(getProcess('a')).toBeDefined();
    expect(getProcess('a')).not.toHaveProperty('projectId');
  });

  it('un projet introuvable le dit', async () => {
    mockParams.current = { id: 'inconnu' };
    await render(<ProjectScreen />);
    expect(screen.getByText('Projet introuvable')).toBeTruthy();
  });
});
