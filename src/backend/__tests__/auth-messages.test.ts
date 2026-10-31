import { describe, expect, it } from '@jest/globals';

import { authErrorMessage, checkCredentials, checkPasswordReset, cleanCode } from '../auth-messages';

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

describe('checkPasswordReset', () => {
  const ok = { email: 'camille@exemple.fr', code: '123456', password: 'nouveau1' };

  it('accepte un code à 6 chiffres, même tapé avec des espaces', () => {
    expect(checkPasswordReset(ok)).toBeNull();
    expect(checkPasswordReset({ ...ok, code: ' 123 456 ' })).toBeNull();
    expect(cleanCode(' 123 456 ')).toBe('123456');
  });

  it('refuse un code vide, trop court ou avec des lettres', () => {
    expect(checkPasswordReset({ ...ok, code: '' })).toMatch(/Saisissez le code/);
    expect(checkPasswordReset({ ...ok, code: '1234' })).toMatch(/6 chiffres/);
    expect(checkPasswordReset({ ...ok, code: '12a456' })).toMatch(/6 chiffres/);
  });

  it('demande un nouveau mot de passe de 6 caractères et une adresse valide', () => {
    expect(checkPasswordReset({ ...ok, password: 'abc' })).toMatch(/au moins 6/);
    expect(checkPasswordReset({ ...ok, email: 'camille' })).toMatch(/pas valide/);
  });

  it('traduit un code expiré', () => {
    expect(authErrorMessage({ code: 'otp_expired' })).toMatch(/nouveau code/);
  });
});
