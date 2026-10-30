import { describe, expect, it } from '@jest/globals';

import { authErrorMessage, checkCredentials } from '../auth-messages';

describe('checkCredentials', () => {
  const ok = { email: 'camille@exemple.fr', password: 'secret1' };

  it('accepte une adresse et un mot de passe', () => {
    expect(checkCredentials(ok, 'connexion')).toBeNull();
    expect(checkCredentials({ ...ok, email: '  camille@exemple.fr ' }, 'creation')).toBeNull();
  });

  it('refuse une adresse vide ou mal écrite', () => {
    expect(checkCredentials({ ...ok, email: ' ' }, 'connexion')).toMatch(/Saisissez/);
    expect(checkCredentials({ ...ok, email: 'camille.exemple.fr' }, 'connexion')).toMatch(/pas valide/);
  });

  it('demande 6 caractères à la création, pas à la connexion', () => {
    expect(checkCredentials({ ...ok, password: 'abc' }, 'creation')).toMatch(/au moins 6/);
    expect(checkCredentials({ ...ok, password: 'abc' }, 'connexion')).toBeNull();
    expect(checkCredentials({ ...ok, password: '' }, 'connexion')).toMatch(/mot de passe/);
  });
});

describe('authErrorMessage', () => {
  it('traduit les erreurs connues', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Adresse e-mail ou mot de passe incorrect.');
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/existe déjà/);
  });

  it('reconnaît une coupure réseau', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toMatch(/injoignable/);
  });

  it('a un message par défaut, sans le texte anglais du serveur', () => {
    expect(authErrorMessage({ code: 'inconnu', message: 'Something broke' })).toBe('La connexion a échoué. Réessayez.');
  });
});
