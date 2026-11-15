import { describe, expect, it } from '@jest/globals';

import type { SharedProcess } from '@/backend/shared';

import { projectProcesses } from '../project-view';

const process = (id: string, projectId?: string) => ({
  id,
  name: id,
  steps: [],
  links: [],
  ...(projectId ? { projectId } : {}),
});
const shared = (id: string, projectId?: string): SharedProcess => ({
  process: process(`partage-${id}`, projectId),
  cloudId: id,
  actor: null,
  ownerName: 'Julie Martin',
  member: false,
  updatedAt: '2026-11-15T10:00:00Z',
});

describe('process d’un projet', () => {
  it('garde les miens puis ceux de l’équipe, avec le nom de leur propriétaire', () => {
    const result = projectProcesses('p1', [process('a', 'p1'), process('b')], [shared('s1', 'p1'), shared('s2', 'p2')]);
    expect(result.map((item) => item.process.id)).toEqual(['a', 'partage-s1']);
    expect(result[0].sharedBy).toBeUndefined();
    expect(result[1].sharedBy).toBe('Julie Martin');
  });
});
