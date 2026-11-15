/**
 * Test d'écran : l'onglet Projets. Les projets que je pilote, puis ceux où je
 * suis collaborateur, avec le nombre de process ; les filtres ; l'état vide.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ProjectsTabScreen from '@/app/(tabs)/projets';
import type { ProjectView } from '@/data/project-view';

let mockProjects: ProjectView[] = [];

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/project-view', () => ({ useAllProjects: () => mockProjects }));
jest.mock('@/data/shared-store', () => ({ useSharedProcesses: () => [] }));
jest.mock('@/data/process-list', () => ({
  useProcessList: () => ({
    status: 'ready',
    processes: [
      { id: 'x', name: 'Process 1', projectId: 'p1', steps: [], links: [] },
      { id: 'y', name: 'Process 2', projectId: 'p1', steps: [], links: [] },
    ],
  }),
}));

const project = (id: string, name: string) => ({ id, name, createdAt: '2026-11-15T10:00:00Z' });

describe('Onglet Projets', () => {
  it('range les projets par rôle, et les filtre', async () => {
    mockProjects = [
      { project: project('p1', 'Migration du support'), role: 'chef' },
      { project: project('p2', 'Achats 2027'), role: 'collaborateur', chefName: 'Julie Martin' },
    ];
    await render(<ProjectsTabScreen />);
    expect(screen.getByText('JE PILOTE')).toBeTruthy();
    expect(screen.getByText('JE SUIS COLLABORATEUR')).toBeTruthy();
    expect(screen.getByText('2 process')).toBeTruthy();
    expect(screen.getByText('Aucun process · chef : Julie Martin')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Collaborateur, 1'));
    expect(screen.queryByText('Migration du support')).toBeNull();
    expect(screen.getByText('Achats 2027')).toBeTruthy();
  });

  it('sans projet, propose d’en créer un', async () => {
    mockProjects = [];
    await render(<ProjectsTabScreen />);
    expect(screen.getByText('Aucun projet pour l’instant')).toBeTruthy();
    expect(screen.getByText('Nouveau projet')).toBeTruthy();
  });
});
