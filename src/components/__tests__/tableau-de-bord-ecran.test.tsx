/**
 * Test d'écran : le tableau de bord d'un projet. On voit l'avancement de tout
 * le projet, l'étape signalée avec son commentaire, l'état de chaque process,
 * et le filtre « À revoir ».
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Member } from '@/backend/sharing';
import { ProjectDashboard } from '@/components/project-dashboard';
import type { MemberReview } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';

const karim: Member = { id: 'k', firstName: 'Karim', lastName: 'Benali', username: 'karim', actor: 'Responsable' };
const ines: Member = { id: 'i', firstName: 'Inès', lastName: 'Moreau', username: 'ines', actor: 'Achats' };

const mockMembers: Record<string, Member[]> = { 'cloud-1': [karim, ines], 'cloud-2': [karim] };
const mockReviews: Record<string, MemberReview[]> = {
  'cloud-1': [
    { memberId: 'k', stepId: 'validation', status: 'valide', comment: null },
    { memberId: 'i', stepId: 'commande', status: 'a_revoir', comment: 'Il faut deux devis.' },
  ],
  'cloud-2': [
    { memberId: 'k', stepId: 'validation', status: 'valide', comment: null },
    { memberId: 'k', stepId: 'refus', status: 'valide', comment: null },
  ],
};

jest.mock('@/backend/sharing', () => {
  const actual = jest.requireActual<typeof import('@/backend/sharing')>('@/backend/sharing');
  return {
    ...actual,
    listMembers: jest.fn(async (cloudId: string) => mockMembers[cloudId] ?? []),
    listProcessReviews: jest.fn(async (cloudId: string) => mockReviews[cloudId] ?? []),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/backend/links', () => ({
  listLinkActivity: jest.fn(async () => ({ links: [], reviews: [] })),
}));

const commande = { ...demandeMateriel, id: 'p1', name: 'Commande de matériel' };
const accueil = { ...demandeMateriel, id: 'p2', name: 'Accueil d’un arrivant' };
const cloture = { ...demandeMateriel, id: 'p3', name: 'Clôture et satisfaction' };

describe('ProjectDashboard', () => {
  it('montre l’avancement du projet, ce qui est à revoir et l’état de chaque process', async () => {
    await render(
      <ProjectDashboard
        projectName="Migration du support"
        items={[
          { process: accueil, cloudId: 'cloud-2', sharedBy: 'Julie Martin' },
          { process: commande, cloudId: 'cloud-1' },
          { process: cloture },
        ]}
      />,
    );

    expect(await screen.findByText('4 relectures faites sur 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('80 % des relectures faites')).toBeOnTheScreen();
    expect(screen.getByText('Migration du support · 3 process')).toBeOnTheScreen();

    // L'étape signalée, avec son commentaire et son auteur.
    expect(screen.getByText('Passer la commande')).toBeOnTheScreen();
    expect(screen.getByText('« Il faut deux devis. »')).toBeOnTheScreen();
    expect(screen.getByText('Inès Moreau · Achats')).toBeOnTheScreen();

    // Les process, ceux à revoir d'abord.
    expect(screen.getByText('1 point à revoir')).toBeOnTheScreen();
    expect(screen.getByText('À Julie Martin · 4 étapes')).toBeOnTheScreen();
    expect(screen.getByText('Tout le monde a relu')).toBeOnTheScreen();
    expect(screen.getByText('Personne ne l’a encore relu.')).toBeOnTheScreen();
    // Partager seulement sur mon process pas encore partagé.
    expect(screen.getAllByText('Partager')).toHaveLength(1);
    expect(screen.getByLabelText('Karim Benali, relecture en cours')).toBeOnTheScreen();
    expect(screen.getByLabelText('Inès Moreau, a signalé un point')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'À revoir, 1' }));
    expect(screen.getByText('Commande de matériel')).toBeOnTheScreen();
    expect(screen.queryByText('Accueil d’un arrivant')).toBeNull();
    expect(screen.queryByText('Clôture et satisfaction')).toBeNull();
  });

  it('propose de réessayer quand les avis ne se lisent pas', async () => {
    const sharing = jest.requireMock<typeof import('@/backend/sharing')>('@/backend/sharing');
    (sharing.listMembers as jest.Mock<typeof sharing.listMembers>).mockRejectedValueOnce(new Error('Hors ligne'));
    await render(
      <ProjectDashboard projectName="Migration du support" items={[{ process: commande, cloudId: 'cloud-1' }]} />,
    );

    expect(await screen.findByText('Impossible de lire les avis de l’équipe.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(await screen.findByText('1 point à revoir')).toBeOnTheScreen();
  });
});
