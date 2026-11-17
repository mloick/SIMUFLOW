import { describe, expect, it, jest } from '@jest/globals';

import { linkMember } from '@/data/validation-data';

import { linkErrorMessage, linkMemberId, linkUrl, listTeamLinkActivity } from '../links';

const mockRpc = jest.fn(async (_name: string, _args: object) => ({
  data: [
    {
      link_id: 'l1',
      actor: 'Logistique',
      step_id: 'livraison',
      status: 'valide',
      comment: null,
      reviewer_name: 'Sami Aït',
      updated_at: '2026-11-16T10:00:00Z',
    },
    {
      link_id: 'l2',
      actor: 'Accueil',
      step_id: null,
      status: null,
      comment: null,
      reviewer_name: null,
      updated_at: null,
    },
  ],
  error: null,
}));
jest.mock('../client', () => ({ supabase: { rpc: (name: string, args: object) => mockRpc(name, args) } }));

describe('liens d’acteur', () => {
  it('donne l’adresse de la page du lien dans la version web', () => {
    expect(linkUrl('abc123')).toBe('https://mloick.github.io/SIMUFLOW/app/lien/abc123');
  });

  it('traduit les erreurs de la page du lien', () => {
    expect(linkErrorMessage({ code: 'P0002' }).message).toMatch(/n’existe pas ou a été retiré/);
    expect(linkErrorMessage({ code: '22023' }).message).toMatch(/plus dans le process/);
    expect(linkErrorMessage({ code: 'PGRST202' }).message).toMatch(/script SQL/);
  });

  it('compte un lien comme un membre, nommé par le nom confirmé', () => {
    const link = { id: 'l1', processId: 'p', actor: 'Achats', token: 't' };
    expect(linkMemberId('l1')).toBe('lien:l1');
    expect(linkMember(link, [])).toEqual({
      id: 'lien:l1',
      name: 'Lien « Achats », pas encore ouvert',
      actor: 'Achats',
    });
    expect(linkMember(link, [{ memberId: 'lien:l1', reviewerName: 'Karim Benali' }]).name).toBe('Karim Benali (lien)');
  });

  it('lit les liens et leurs avis pour l’équipe, sans jeton', async () => {
    const activity = await listTeamLinkActivity('cloud-1');
    expect(mockRpc).toHaveBeenCalledWith('link_activity_of', { p_process: 'cloud-1' });
    // Un lien sans avis compte quand même ; aucun jeton n'est lu.
    expect(activity.links).toEqual([
      { id: 'l1', actor: 'Logistique' },
      { id: 'l2', actor: 'Accueil' },
    ]);
    expect(activity.reviews).toEqual([
      {
        memberId: 'lien:l1',
        stepId: 'livraison',
        status: 'valide',
        comment: null,
        reviewerName: 'Sami Aït',
        updatedAt: '2026-11-16T10:00:00Z',
      },
    ]);
  });
});
