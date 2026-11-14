import { describe, expect, it } from '@jest/globals';

import { sharedLocalId, toShared } from '../shared';

const row = {
  process_id: 'aaaa-1',
  name: 'Demande de matériel',
  source: 'drawio' as const,
  content: { steps: [{ id: 's1', kind: 'task' as const, title: 'Passer la commande', actor: 'Achats' }], links: [] },
  updated_at: '2026-11-14T10:00:00Z',
  actor: ' Achats ',
  owner_first_name: 'Julie',
  owner_last_name: 'Martin',
  owner_username: 'julie.martin',
};

describe('process partagés avec moi', () => {
  it('lit un process partagé avec un identifiant propre au téléphone', () => {
    const shared = toShared(row);
    expect(shared.process.id).toBe(sharedLocalId('aaaa-1'));
    expect(shared.process.id).toBe('partage-aaaa-1');
    expect(shared.cloudId).toBe('aaaa-1');
    expect(shared.process.steps).toHaveLength(1);
    expect(shared.actor).toBe('Achats');
    expect(shared.ownerName).toBe('Julie Martin');
  });

  it('nomme le propriétaire par son identifiant s’il n’a pas de nom', () => {
    expect(toShared({ ...row, owner_first_name: null, owner_last_name: null }).ownerName).toBe('@julie.martin');
    expect(toShared({ ...row, owner_first_name: null, owner_last_name: null, owner_username: null }).ownerName).toBe(
      'un autre compte',
    );
    expect(toShared({ ...row, actor: '  ' }).actor).toBeNull();
  });

  it('refuse un process mal enregistré', () => {
    expect(() => toShared({ ...row, content: null as never })).toThrow(/mal enregistré/);
  });
});
