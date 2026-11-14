import { describe, expect, it } from '@jest/globals';

import { memberName, sharingErrorMessage } from '../sharing';

describe('partage', () => {
  it('traduit les erreurs des fonctions SQL', () => {
    expect(sharingErrorMessage({ code: 'P0002' }).message).toMatch(/Aucun compte/);
    expect(sharingErrorMessage({ code: '42501' }).message).toMatch(/propriétaire/);
    expect(sharingErrorMessage({ code: '22023' }).message).toMatch(/C’est vous/);
    expect(sharingErrorMessage({ code: '54000' }).message).toMatch(/100 membres/);
    expect(sharingErrorMessage({ code: 'PGRST202' }).message).toMatch(/script SQL/);
    expect(sharingErrorMessage({}).message).toMatch(/connexion/);
  });

  it('nomme un membre par son nom, son identifiant, ou « sans profil »', () => {
    const base = { id: 'm', actor: null };
    expect(memberName({ ...base, firstName: 'Julie', lastName: 'Martin', username: 'julie.martin' })).toBe(
      'Julie Martin',
    );
    expect(memberName({ ...base, firstName: null, lastName: null, username: 'julie.martin' })).toBe('@julie.martin');
    expect(memberName({ ...base, firstName: null, lastName: null, username: null })).toBe('Membre sans profil');
  });
});
