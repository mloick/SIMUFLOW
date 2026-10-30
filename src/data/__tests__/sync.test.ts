import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { mergeAfterSync, syncEntries, type CloudApi, type SyncEntry } from '../sync';

const proc = (id: string, name = id): Process => ({ id, name, steps: [], links: [] });

/** Un faux serveur en mémoire, qui note ce qu'on lui demande. */
function fakeServer(initial: Process[] = []) {
  const rows = new Map(initial.map((process) => [process.id, process]));
  const calls: string[] = [];
  let next = 1;
  const api: CloudApi = {
    list: async () => [...rows.values()],
    create: async (process) => {
      const id = `serveur-${next++}`;
      calls.push(`create ${process.name}`);
      rows.set(id, { ...process, id });
      return { ...process, id };
    },
    update: async (id, process) => {
      calls.push(`update ${id} ${process.name}`);
      rows.set(id, { ...process, id });
    },
    remove: async (id) => {
      calls.push(`remove ${id}`);
      rows.delete(id);
    },
  };
  return { api, rows, calls };
}

describe('syncEntries', () => {
  it('envoie un process modifié sur le téléphone, puis le marque à jour', async () => {
    const { api, rows, calls } = fakeServer([proc('s1', 'Avant')]);
    const result = await syncEntries([{ process: proc('a', 'Après'), cloudId: 's1', modified: true }], api);
    expect(calls).toEqual(['update s1 Après']);
    expect(rows.get('s1')?.name).toBe('Après');
    expect(result).toEqual([{ process: proc('a', 'Après'), cloudId: 's1' }]);
  });

  it('reprend la version du serveur d’un process modifié ailleurs, sous l’identifiant du téléphone', async () => {
    const { api, calls } = fakeServer([proc('s1', 'Modifié ailleurs')]);
    const result = await syncEntries([{ process: proc('a', 'Ancien'), cloudId: 's1' }], api);
    expect(calls).toEqual([]);
    expect(result).toEqual([{ process: proc('a', 'Modifié ailleurs'), cloudId: 's1' }]);
  });

  it('envoie les process qui ne sont que sur le téléphone et garde leur identifiant local', async () => {
    const { api, rows, calls } = fakeServer();
    const result = await syncEntries([{ process: proc('import-1', 'Accueil') }], api);
    expect(calls).toEqual(['create Accueil']);
    expect(result).toEqual([{ process: proc('import-1', 'Accueil'), cloudId: 'serveur-1' }]);
    expect(rows.size).toBe(1);
  });

  it('ne renvoie pas un process déjà sur le serveur', async () => {
    const { api, calls } = fakeServer([proc('s1', 'Accueil')]);
    const local: SyncEntry[] = [{ process: proc('import-1', 'Accueil'), cloudId: 's1' }];
    expect(await syncEntries(local, api)).toEqual(local);
    expect(calls).toEqual([]);
  });

  it('supprime sur le serveur ce qui a été retiré du téléphone', async () => {
    const { api, rows, calls } = fakeServer([proc('s1'), proc('s2')]);
    const result = await syncEntries(
      [
        { process: proc('a'), cloudId: 's1', deleted: true },
        { process: proc('b'), cloudId: 's2' },
      ],
      api,
    );
    expect(calls).toEqual(['remove s1']);
    expect([...rows.keys()]).toEqual(['s2']);
    expect(result.map((entry) => entry.process.id)).toEqual(['b']);
  });

  it('récupère les process créés depuis un autre appareil', async () => {
    const { api } = fakeServer([proc('s9', 'Venu d’ailleurs')]);
    const result = await syncEntries([], api);
    expect(result).toEqual([{ process: proc('s9', 'Venu d’ailleurs'), cloudId: 's9' }]);
  });

  it('retire du téléphone un process supprimé depuis un autre appareil', async () => {
    const { api } = fakeServer([]);
    expect(await syncEntries([{ process: proc('a'), cloudId: 's1' }], api)).toEqual([]);
  });

  it('ne contacte pas le serveur pour une suppression déjà faite ailleurs', async () => {
    const { api, calls } = fakeServer([]);
    expect(await syncEntries([{ process: proc('a'), cloudId: 's1', deleted: true }], api)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('s’arrête sans rien changer si le serveur ne répond pas', async () => {
    const api: CloudApi = {
      list: async () => {
        throw new TypeError('Network request failed');
      },
      update: async () => {},
      create: async (process) => process,
      remove: async () => {},
    };
    await expect(syncEntries([{ process: proc('a') }], api)).rejects.toThrow('Network');
  });
});

describe('mergeAfterSync', () => {
  it('garde une modification faite pendant la synchronisation', () => {
    const before: SyncEntry[] = [{ process: proc('a', 'V1'), cloudId: 's1' }];
    const result: SyncEntry[] = [{ process: proc('a', 'V1'), cloudId: 's1' }];
    const now: SyncEntry[] = [{ process: proc('a', 'V2'), cloudId: 's1', modified: true }];
    expect(mergeAfterSync(before, result, now)).toEqual([{ process: proc('a', 'V2'), cloudId: 's1', modified: true }]);
  });

  it('efface la marque « modifié » une fois la version envoyée', () => {
    const sent = proc('a', 'V2');
    const before: SyncEntry[] = [{ process: sent, cloudId: 's1', modified: true }];
    const result: SyncEntry[] = [{ process: sent, cloudId: 's1' }];
    expect(mergeAfterSync(before, result, before)).toEqual(result);
  });

  const before: SyncEntry[] = [{ process: proc('a') }, { process: proc('b'), cloudId: 's2' }];
  const result: SyncEntry[] = [
    { process: proc('s9'), cloudId: 's9' },
    { process: proc('a'), cloudId: 's1' },
    { process: proc('b'), cloudId: 's2' },
  ];

  it('sans changement pendant la synchro, garde le résultat', () => {
    expect(mergeAfterSync(before, result, before)).toEqual(result);
  });

  it('garde un import fait pendant la synchro', () => {
    const now = [{ process: proc('c') }, ...before];
    expect(mergeAfterSync(before, result, now)[0]).toEqual({ process: proc('c') });
  });

  it('marque à supprimer un process retiré pendant son envoi', () => {
    const now = [before[1]]; // « a » retiré du téléphone pendant qu'il partait
    const merged = mergeAfterSync(before, result, now);
    expect(merged.find((entry) => entry.process.id === 'a')).toEqual({
      process: proc('a'),
      cloudId: 's1',
      deleted: true,
    });
  });

  it('garde la marque « à supprimer » posée pendant la synchro', () => {
    const now = [before[0], { ...before[1], deleted: true as const }];
    expect(mergeAfterSync(before, result, now).find((entry) => entry.process.id === 'b')?.deleted).toBe(true);
  });
});
