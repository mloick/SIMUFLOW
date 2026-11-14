import { describe, expect, it } from '@jest/globals';

import { linkMember } from '@/data/validation-data';

import { linkErrorMessage, linkMemberId, linkUrl } from '../links';

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
});
