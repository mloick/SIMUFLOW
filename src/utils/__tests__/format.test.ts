import { describe, expect, it } from '@jest/globals';

import { normalizeForSearch, plural } from '../format';

describe('plural', () => {
  it('accorde au singulier jusqu’à 1, au pluriel au-delà', () => {
    expect(plural(0, 'étape')).toBe('0 étape');
    expect(plural(1, 'étape')).toBe('1 étape');
    expect(plural(3, 'étape')).toBe('3 étapes');
  });
});

describe('normalizeForSearch', () => {
  it('ignore les accents, les majuscules et le type d’apostrophe', () => {
    expect(normalizeForSearch('  Demande d’Accès ')).toBe("demande d'acces");
    expect(normalizeForSearch('Commande de matériel')).toContain('materiel');
  });
});
