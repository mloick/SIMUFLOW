import { describe, expect, it } from '@jest/globals';

import { authErrorMessage, checkCredentials, checkNewPassword, parseRecoveryLink } from '../auth-messages';

describe('checkCredentials', () => {
  const ok = { email: 'camille@exemple.fr', password: 'Secret-12' };

  it('accepte une adresse et un mot de passe', () => {
    expect(checkCredentials(ok, 'connexion')).toBeNull();
    expect(checkCredentials({ ...ok, email: '  camille@exemple.fr ' }, 'creation')).toBeNull();
  });

  it('refuse une adresse vide ou mal écrite', () => {
    expect(checkCredentials({ ...ok, email: ' ' }, 'connexion')).toMatch(/Saisissez/);
    expect(checkCredentials({ ...ok, email: 'camille.exemple.fr' }, 'connexion')).toMatch(/pas valide/);
  });

  it('demande 8 caractères à la création, pas à la connexion', () => {
    expect(checkCredentials({ ...ok, password: 'Abc-123' }, 'creation')).toMatch(/au moins 8/);
    expect(checkCredentials({ ...ok, password: 'Abcd-123' }, 'creation')).toBeNull();
    // Un ancien compte créé avec 6 caractères peut toujours se connecter.
    expect(checkCredentials({ ...ok, password: 'abcdef' }, 'connexion')).toBeNull();
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

describe('mot de passe oublié', () => {
  it('demande un nouveau mot de passe de 8 caractères', () => {
    expect(checkNewPassword('Abc-123')).toMatch(/au moins 8/);
    expect(checkNewPassword('Nouveau-1')).toBeNull();
  });

  it('demande une minuscule, une majuscule, un chiffre et un symbole, comme Supabase', () => {
    expect(checkNewPassword('nouveau1')).toBe(
      'Il manque au mot de passe une majuscule et un symbole (par exemple ! ? # -).',
    );
    expect(checkNewPassword('NOUVEAU-1')).toBe('Il manque au mot de passe une minuscule.');
    expect(checkNewPassword('motdepasse')).toBe(
      'Il manque au mot de passe une majuscule, un chiffre et un symbole (par exemple ! ? # -).',
    );
    expect(checkNewPassword('Nouveau_1')).toBeNull();
  });

  it('lit la session dans le lien qui rouvre l’app', () => {
    const url = 'simuflow://nouveau-mot-de-passe#access_token=aaa&expires_in=3600&refresh_token=bbb&type=recovery';
    expect(parseRecoveryLink(url)).toEqual({ kind: 'session', accessToken: 'aaa', refreshToken: 'bbb' });
  });

  it('traduit un lien expiré ou déjà utilisé', () => {
    const url =
      'simuflow://nouveau-mot-de-passe#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid';
    expect(parseRecoveryLink(url)).toEqual({ kind: 'error', message: expect.stringMatching(/expiré/) });
  });

  it('ignore une adresse sans session', () => {
    expect(parseRecoveryLink('simuflow://nouveau-mot-de-passe')).toBeNull();
    expect(parseRecoveryLink(null)).toBeNull();
  });
});
