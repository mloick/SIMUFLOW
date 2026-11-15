import { describe, expect, it } from '@jest/globals';

import type { Project } from '@/domain';

import { mergeProjectsAfterSync, syncProjects, type ProjectApi, type ProjectEntry } from '../project-sync';

const proj = (id: string, name = id): Project => ({ id, name, createdAt: '2026-11-15T10:00:00.000Z' });

/** Un faux serveur en mémoire, qui note ce qu'on lui demande. */
function fakeServer(initial: Project[] = []) {
  const rows = new Map(initial.map((project) => [project.id, project]));
  const calls: string[] = [];
  const api: ProjectApi = {
    list: async () => [...rows.values()],
    create: async (project) => {
      calls.push(`create ${project.id}`);
      rows.set(project.id, project);
    },
    update: async (project) => {
      calls.push(`update ${project.id} ${project.name}`);
      rows.set(project.id, project);
    },
    remove: async (id) => {
      calls.push(`remove ${id}`);
      rows.delete(id);
    },
  };
  return { api, rows, calls };
}

describe('syncProjects', () => {
  it('crée sur le serveur un projet du téléphone, sous le même identifiant', async () => {
    const { api, rows, calls } = fakeServer();
    const result = await syncProjects([{ project: proj('p1', 'Migration') }], api);
    expect(calls).toEqual(['create p1']);
    expect(rows.get('p1')?.name).toBe('Migration');
    expect(result).toEqual([{ project: proj('p1', 'Migration'), synced: true }]);
  });

  it('envoie un renommage, puis le marque à jour', async () => {
    const { api, calls } = fakeServer([proj('p1', 'Avant')]);
    const result = await syncProjects([{ project: proj('p1', 'Après'), synced: true, modified: true }], api);
    expect(calls).toEqual(['update p1 Après']);
    expect(result).toEqual([{ project: proj('p1', 'Après'), synced: true }]);
  });

  it('supprime sur le serveur un projet retiré du téléphone', async () => {
    const { api, rows, calls } = fakeServer([proj('p1')]);
    const result = await syncProjects([{ project: proj('p1'), synced: true, deleted: true }], api);
    expect(calls).toEqual(['remove p1']);
    expect(rows.size).toBe(0);
    expect(result).toEqual([]);
  });

  it('reprend les changements faits ailleurs : renommé, supprimé, créé', async () => {
    const { api, calls } = fakeServer([proj('p1', 'Renommé ailleurs'), proj('p3', 'Nouveau ailleurs')]);
    const local: ProjectEntry[] = [
      { project: proj('p1', 'Ancien nom'), synced: true },
      { project: proj('p2', 'Supprimé ailleurs'), synced: true },
    ];
    const result = await syncProjects(local, api);
    expect(calls).toEqual([]);
    expect(result).toEqual([
      { project: proj('p3', 'Nouveau ailleurs'), synced: true },
      { project: proj('p1', 'Renommé ailleurs'), synced: true },
    ]);
  });

  it('un projet déjà sur le serveur sans que le téléphone le sache est mis à jour, pas recréé', async () => {
    const { api, calls } = fakeServer([proj('p1', 'Serveur')]);
    await syncProjects([{ project: proj('p1', 'Téléphone') }], api);
    expect(calls).toEqual(['update p1 Téléphone']);
  });
});

describe('mergeProjectsAfterSync', () => {
  it('garde ce qui a changé sur le téléphone pendant la synchronisation', () => {
    const p1: ProjectEntry = { project: proj('p1', 'Un') };
    const p2: ProjectEntry = { project: proj('p2', 'Deux') };
    const before = [p1, p2];
    const result: ProjectEntry[] = [
      { project: proj('s1', 'Du serveur'), synced: true },
      { project: proj('p1', 'Un'), synced: true },
      { project: proj('p2', 'Deux'), synced: true },
    ];
    const added: ProjectEntry = { project: proj('p4', 'Créé pendant') };
    const now = [added, { project: proj('p1', 'Un renommé') }]; // p2 retiré pendant la synchro
    expect(mergeProjectsAfterSync(before, result, now)).toEqual([
      added,
      { project: proj('s1', 'Du serveur'), synced: true },
      { project: proj('p1', 'Un renommé'), synced: true, modified: true },
      { project: proj('p2', 'Deux'), synced: true, deleted: true },
    ]);
  });
});
