import { describe, expect, it } from '@jest/globals';

import { displayName, nextUsername, profileProblem, suggestUsername, usernameProblem } from '../profile';

describe('profil', () => {
  it('propose un identifiant sans accents ni espaces', () => {
    expect(suggestUsername('Julie', 'Martin')).toBe('julie.martin');
    expect(suggestUsername(' Élodie ', 'Le Gall')).toBe('elodie.le-gall');
    expect(suggestUsername('Jean-François', "D'Arcy")).toBe('jean-francois.d-arcy');
    expect(suggestUsername('', 'Martin')).toBe('martin');
    expect(suggestUsername('Maximilienne-Augustine', 'De La Fontaine-Rochefort').length).toBeLessThanOrEqual(30);
  });

  it('propose une variante quand l’identifiant est pris', () => {
    expect(nextUsername('julie.martin')).toBe('julie.martin2');
    expect(nextUsername('julie.martin2')).toBe('julie.martin3');
    expect(nextUsername('a'.repeat(30))).toHaveLength(30);
  });

  it('vérifie l’identifiant comme la base', () => {
    expect(usernameProblem('julie.martin')).toBeNull();
    expect(usernameProblem('jm')).toMatch(/Au moins 3/);
    expect(usernameProblem('Julie')).toMatch(/Minuscules/);
    expect(usernameProblem('.julie')).toMatch(/commence/);
  });

  it('exige prénom, nom et identifiant', () => {
    const ok = { firstName: 'Julie', lastName: 'Martin', username: 'julie.martin' };
    expect(profileProblem(ok)).toBeNull();
    expect(profileProblem({ ...ok, firstName: ' ' })).toBe('Le prénom est obligatoire.');
    expect(profileProblem({ ...ok, lastName: '' })).toBe('Le nom est obligatoire.');
    expect(profileProblem({ ...ok, username: 'x' })).toMatch(/Au moins/);
    expect(displayName(ok)).toBe('Julie Martin');
  });
});
