import { describe, expect, it } from '@jest/globals';

import { initials } from '../initials';

describe('initials', () => {
  it('prend la première lettre des deux premiers mots, d’un nom ou d’une adresse', () => {
    expect(initials('Camille Martin')).toBe('CM');
    expect(initials('camille.martin@exemple.fr')).toBe('CM');
    expect(initials('camille')).toBe('CA');
    expect(initials('')).toBe('');
  });
});
