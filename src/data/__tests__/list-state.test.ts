import { describe, expect, it } from '@jest/globals';

import { listState, type ListSignals } from '../list-state';

const base: ListSignals = {
  connected: true,
  synced: false,
  hasCloudCopies: false,
  sync: 'syncing',
  syncOffline: false,
  online: true,
  processes: [],
};

describe('état réel de la liste', () => {
  it('chargement : connecté, première synchronisation en cours, rien du compte sur le téléphone', () => {
    expect(listState(base)).toEqual({ status: 'loading' });
  });

  it('erreur : la première synchronisation a échoué côté serveur', () => {
    expect(listState({ ...base, sync: 'error' })).toEqual({ status: 'error' });
  });

  it('hors connexion : la dernière version enregistrée, avec le bandeau', () => {
    expect(listState({ ...base, online: false })).toEqual({ status: 'ready', processes: [], offline: true });
    expect(listState({ ...base, sync: 'error', syncOffline: true })).toMatchObject({ status: 'ready' });
  });

  it('contenu : sans compte, ou une fois le compte synchronisé', () => {
    expect(listState({ ...base, connected: false })).toEqual({ status: 'ready', processes: [], offline: false });
    expect(listState({ ...base, synced: true, sync: 'done' })).toMatchObject({ status: 'ready', offline: false });
    // Des process du compte sont déjà sur le téléphone : on les montre pendant la synchro.
    expect(listState({ ...base, hasCloudCopies: true })).toMatchObject({ status: 'ready' });
  });
});
