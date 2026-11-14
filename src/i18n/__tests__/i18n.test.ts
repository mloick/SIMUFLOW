import { afterEach, describe, expect, it } from '@jest/globals';

import { authErrorMessage, checkCredentials } from '@/backend/auth-messages';
import { profileProblem, roleLabel } from '@/domain';

import { getLanguage, getLocale, getT, resolveLanguage, setLanguageSetting } from '..';
import { en } from '../messages/en';
import { fr } from '../messages/fr';

/** Les clés d'un catalogue, à plat (« profil.title »), avec la longueur des listes. */
function keys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value))
    return [`${prefix}[${value.length}]`, ...value.flatMap((item, i) => keys(item, `${prefix}${i}.`))];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) => keys(item, `${prefix}${key}.`));
  return [`${prefix}${typeof value}`];
}

afterEach(() => setLanguageSetting('auto'));

describe('resolveLanguage', () => {
  it('suit le téléphone en automatique : français s’il est en français, anglais sinon', () => {
    expect(resolveLanguage('auto', 'fr-FR')).toBe('fr');
    expect(resolveLanguage('auto', 'fr-CA')).toBe('fr');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'de-DE')).toBe('en');
    expect(resolveLanguage('auto', '')).toBe('en');
  });

  it('garde le choix de la personne', () => {
    expect(resolveLanguage('fr', 'en-US')).toBe('fr');
    expect(resolveLanguage('en', 'fr-FR')).toBe('en');
  });
});

describe('catalogues', () => {
  it('ont les mêmes clés, les mêmes types et les mêmes longueurs de listes', () => {
    expect(keys(en)).toEqual(keys(fr));
  });

  it('ne laissent aucun texte vide', () => {
    const empty = (value: unknown): boolean =>
      typeof value === 'string'
        ? value.trim() === ''
        : Boolean(value && typeof value === 'object' && Object.values(value).some(empty));
    expect(empty(fr)).toBe(false);
    expect(empty(en)).toBe(false);
  });
});

describe('changer de langue', () => {
  it('change les textes, les messages et le format des dates', () => {
    expect(getLanguage()).toBe('fr');
    expect(getT().profil.title).toBe('Profil');

    setLanguageSetting('en');
    expect(getLanguage()).toBe('en');
    expect(getLocale()).toBe('en-GB');
    expect(getT().profil.title).toBe('Profile');
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Wrong email address or password.');
    expect(checkCredentials({ email: 'a@b.fr', password: 'abc' }, 'creation')).toMatch(/at least 8/);
    expect(profileProblem({ firstName: '', lastName: 'Martin', username: 'julie' })).toBe('First name is required.');
    expect(roleLabel('chef_de_projet')).toBe('Project manager');
    expect(getT().profil.seeAlerts(2)).toBe('See alerts · 2 new');

    setLanguageSetting('fr');
    expect(roleLabel('chef_de_projet')).toBe('Chef de projet');
    expect(getT().profil.seeAlerts(2)).toBe('Voir les alertes · 2 nouvelles');
  });

  it('ajoute la règle du mot de passe au message « trop faible »', () => {
    setLanguageSetting('en');
    expect(authErrorMessage({ code: 'weak_password' })).toMatch(/^Password too weak\. At least 8 characters/);
  });
});
