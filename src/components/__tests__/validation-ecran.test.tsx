/**
 * Test d'écran : le propriétaire suit la validation d'un process partagé. Il
 * voit où en est chaque membre, les étapes à revoir avec leur commentaire, puis
 * « Process entièrement validé » quand tout est validé.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Member } from '@/backend/sharing';
import { ValidationPanel } from '@/components/validation-panel';
import type { MemberReview } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';

const mockMembers: Member[] = [
  { id: 'k', firstName: 'Karim', lastName: 'Benali', username: 'karim.benali', actor: 'Responsable' },
  { id: 'i', firstName: 'Inès', lastName: 'Moreau', username: 'ines.moreau', actor: 'Achats' },
];

let mockReviews: MemberReview[] = [];

jest.mock('@/backend/sharing', () => {
  const actual = jest.requireActual<typeof import('@/backend/sharing')>('@/backend/sharing');
  return {
    ...actual,
    listMembers: jest.fn(async () => mockMembers),
    listProcessReviews: jest.fn(async () => mockReviews),
  };
});

describe('ValidationPanel', () => {
  it('montre l’avancement, les étapes à revoir, puis la validation complète', async () => {
    mockReviews = [
      { memberId: 'k', stepId: 'validation', status: 'valide', comment: null },
      { memberId: 'k', stepId: 'refus', status: 'valide', comment: null },
      { memberId: 'i', stepId: 'commande', status: 'a_revoir', comment: 'Il faut deux devis.' },
    ];
    await render(<ValidationPanel process={demandeMateriel} cloudId="cloud-1" />);

    expect(await screen.findByText('2 membres sur 2 ont fini · 1 étape à revoir')).toBeOnTheScreen();
    expect(screen.getByText('Responsable · 2/2 validées')).toBeOnTheScreen();
    expect(screen.getByText('Achats · 0/1 validée · 1 à revoir')).toBeOnTheScreen();
    expect(screen.getByText('À revoir · Inès Moreau')).toBeOnTheScreen();
    expect(screen.getByText('« Il faut deux devis. »')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'À revoir · 1' }));
    expect(screen.queryByText('Livrer le matériel')).toBeNull();
    expect(screen.getByText('Passer la commande')).toBeOnTheScreen();

    mockReviews = [...mockReviews.slice(0, 2), { memberId: 'i', stepId: 'commande', status: 'valide', comment: null }];
    await fireEvent.press(screen.getByText('Actualiser'));
    expect(await screen.findByText('✓ Process entièrement validé par les 2 membres.')).toBeOnTheScreen();
  });
});
