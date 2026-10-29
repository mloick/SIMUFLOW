import { describe, expect, it } from '@jest/globals';

import { countPaths, longestPath, shortestPath } from '../paths';
import type { Link, Step } from '../types';
import { copie, demandeMateriel } from '../exemples';

const ids = (path: ReturnType<typeof shortestPath>) => path?.steps.map((s) => s.stepId);

describe('shortestPath (cas simple)', () => {
  it('prend la branche la plus courte jusqu’à la fin', () => {
    const path = shortestPath(demandeMateriel);
    expect(ids(path)).toEqual(['demande', 'validation', 'refus', 'fin']);
    expect(path?.steps.map((s) => s.linkId)).toEqual([undefined, 'l1', 'l3', 'l6']);
    expect(path?.duration).toBe(3);
  });

  it('renvoie null sans point de départ', () => {
    expect(shortestPath({ ...demandeMateriel, steps: [], links: [] })).toBeNull();
  });
});

describe('longestPath (cas complexe)', () => {
  it('prend la branche la plus longue jusqu’à la fin', () => {
    const path = longestPath(demandeMateriel);
    expect(ids(path)).toEqual(['demande', 'validation', 'commande', 'livraison', 'fin']);
    expect(path?.duration).toBe(8);
  });

  it('ne tourne pas en rond dans une boucle', () => {
    const p = copie();
    // Retour en arrière : la livraison peut renvoyer à la validation.
    p.links.push({ id: 'retour', from: 'livraison', to: 'validation', label: 'incomplet' });
    expect(ids(longestPath(p))).toEqual(['demande', 'validation', 'commande', 'livraison', 'fin']);
  });

  it('part du départ demandé', () => {
    expect(ids(longestPath(demandeMateriel, 'commande'))).toEqual(['commande', 'livraison', 'fin']);
  });
});

describe('countPaths', () => {
  it('compte les chemins du départ à la fin', () => {
    expect(countPaths(demandeMateriel)).toEqual({ count: 2, capped: false });
  });

  it('plafonne le nombre de chemins', () => {
    // 12 décisions à la suite : 2^12 = 4096 chemins, au-delà du plafond.
    const steps: Step[] = [{ id: 's', kind: 'start', title: 'Départ' }];
    const links: Link[] = [];
    let previous = 's';
    for (let i = 0; i < 12; i++) {
      steps.push({ id: `d${i}`, kind: 'decision', title: `Choix ${i}` });
      steps.push({ id: `a${i}`, kind: 'task', title: `A ${i}` });
      steps.push({ id: `b${i}`, kind: 'task', title: `B ${i}` });
      steps.push({ id: `j${i}`, kind: 'task', title: `Suite ${i}` });
      links.push({ id: `${previous}-d${i}`, from: previous, to: `d${i}` });
      links.push({ id: `d${i}-a`, from: `d${i}`, to: `a${i}`, label: 'a' });
      links.push({ id: `d${i}-b`, from: `d${i}`, to: `b${i}`, label: 'b' });
      links.push({ id: `a${i}-j`, from: `a${i}`, to: `j${i}` });
      links.push({ id: `b${i}-j`, from: `b${i}`, to: `j${i}` });
      previous = `j${i}`;
    }
    steps.push({ id: 'f', kind: 'end', title: 'Fin' });
    links.push({ id: 'fin', from: previous, to: 'f' });
    expect(countPaths({ id: 'x', name: 'Gros process', steps, links })).toEqual({ count: 2000, capped: true });
  });
});
