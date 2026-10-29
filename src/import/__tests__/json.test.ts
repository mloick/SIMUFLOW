import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '@/domain/exemples';

import { importProcessFile } from '..';
import { parseProcessJson, processToJson } from '../json';

describe('parseProcessJson', () => {
  it('relit un process exporté à l’identique', () => {
    const { processes } = parseProcessJson(processToJson(demandeMateriel), 'x.json');
    expect(processes[0]).toMatchObject({
      name: demandeMateriel.name,
      source: 'json',
      steps: demandeMateriel.steps,
      links: demandeMateriel.links,
    });
  });

  it('complète les valeurs manquantes', () => {
    const { processes } = parseProcessJson('{"steps":[{"id":1,"title":"A"},{"id":2,"kind":"end"}],"links":[{"from":1,"to":2}]}', 'Mon process.json');
    expect(processes[0]).toMatchObject({
      name: 'Mon process',
      steps: [{ id: '1', kind: 'task', title: 'A' }, { id: '2', kind: 'end', title: '' }],
      links: [{ id: 'l1', from: '1', to: '2' }],
    });
  });

  it('explique chaque erreur', () => {
    expect(() => parseProcessJson('pas du json', 'x')).toThrow('pas un JSON valide');
    expect(() => parseProcessJson('{"steps":[]}', 'x')).toThrow('aucune étape');
    expect(() => parseProcessJson('{"steps":[{"id":"a"},{"id":"a"}]}', 'x')).toThrow('Étape 2 : l’identifiant « a » est déjà utilisé.');
    expect(() => parseProcessJson('{"steps":[{"id":"a","kind":"x"}]}', 'x')).toThrow('Étape 1 : rôle « x » inconnu');
    expect(() => parseProcessJson('{"steps":[{"id":"a"}],"links":[{"from":"a"}]}', 'x')).toThrow('Lien 1');
    expect(() => parseProcessJson('{"format":"autre","steps":[{"id":"a"}]}', 'x')).toThrow('format');
  });
});

describe('importProcessFile', () => {
  it('choisit le lecteur selon le fichier', () => {
    expect(importProcessFile('a.json', processToJson(demandeMateriel)).processes[0].source).toBe('json');
    expect(() => importProcessFile('a.pdf', 'xxx')).toThrow('Format non reconnu');
  });
});
