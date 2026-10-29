import { describe, expect, it } from '@jest/globals';

import { formatNumber, normalizeForSearch, plural } from '../format';

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

describe('formatNumber', () => {
  it('écrit les décimales avec une virgule', () => {
    expect(formatNumber(0.5)).toBe('0,5');
    expect(formatNumber(3)).toBe('3');
    expect(formatNumber(0.1 + 0.2)).toBe('0,3');
    expect(plural(1.5, 'jour')).toBe('1,5 jours');
  });
});
