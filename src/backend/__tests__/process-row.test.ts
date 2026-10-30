import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '@/domain/exemples';

import { fromRow, toRow, type ProcessRow } from '../process-row';

const row = (overrides: Partial<ProcessRow> = {}): ProcessRow => ({
  id: '5b0c…',
  owner_id: '1111…',
  created_at: '2026-10-30T15:00:00Z',
  updated_at: '2026-10-30T15:00:00Z',
  ...toRow(demandeMateriel),
  ...overrides,
});

describe('process ↔ ligne de la table', () => {
  it('garde étapes, liens, nom et origine dans un aller-retour', () => {
    const back = fromRow(row({ id: 'serveur-1' }));
    expect(back).toEqual({ ...demandeMateriel, id: 'serveur-1' });
  });

  it('n’envoie ni identifiant ni propriétaire : la base les remplit', () => {
    expect(Object.keys(toRow(demandeMateriel)).sort()).toEqual(['content', 'name', 'source']);
  });

  it('nettoie le nom', () => {
    expect(toRow({ ...demandeMateriel, name: '  Achats  ' }).name).toBe('Achats');
  });

  it('refuse une ligne sans étapes', () => {
    expect(() => fromRow(row({ content: {} as ProcessRow['content'] }))).toThrow(/mal enregistré/);
  });
});
