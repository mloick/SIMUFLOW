import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';

import { allPaths, overviewOf } from '../families';

/**
 * Process fictif à deux décisions :
 *   début → urgent ? ─oui→ contourner → clos
 *                    └non→ diagnostiquer → résolu ? ─oui→ clos
 *                                                  └N3→ escalader → clos
 */
const incident: Process = {
  id: 'incident',
  name: 'Incident',
  steps: [
    { id: 'debut', kind: 'start', title: 'Début' },
    { id: 'urgent', kind: 'decision', title: 'Urgent ?', actor: 'Support N1', duration: 1 },
    { id: 'contourner', kind: 'task', title: 'Contourner', actor: 'Support N1', duration: 1 },
    { id: 'diagnostiquer', kind: 'task', title: 'Diagnostiquer', actor: 'Support N2', duration: 2 },
    { id: 'resolu', kind: 'decision', title: 'Résolu ?', actor: 'Support N2' },
    { id: 'escalader', kind: 'task', title: 'Escalader', actor: 'Support N3', duration: 3 },
    { id: 'clos', kind: 'end', title: 'Clos' },
  ],
  links: [
    { id: 'l1', from: 'debut', to: 'urgent' },
    { id: 'l2', from: 'urgent', to: 'contourner', label: 'oui' },
    { id: 'l3', from: 'urgent', to: 'diagnostiquer', label: 'non' },
    { id: 'l4', from: 'contourner', to: 'clos' },
    { id: 'l5', from: 'diagnostiquer', to: 'resolu' },
    { id: 'l6', from: 'resolu', to: 'clos', label: 'oui' },
    { id: 'l7', from: 'resolu', to: 'escalader', label: 'N3' },
    { id: 'l8', from: 'escalader', to: 'clos' },
  ],
};

describe('tous les cas', () => {
  it('liste tous les chemins, du départ à la fin', () => {
    const { paths, capped } = allPaths(incident);
    expect(capped).toBe(false);
    expect(paths.map((path) => path.duration).sort()).toEqual([2, 3, 6]);
  });

  it('range les chemins par sortie de la première décision', () => {
    const { families, pathCount } = overviewOf(incident);
    expect(pathCount).toBe(3);
    expect(families.map((family) => [family.label, family.paths.length, family.minDays, family.maxDays])).toEqual([
      ['Urgent : oui', 1, 2, 2],
      ['Urgent : non', 2, 3, 6],
    ]);
    expect(families[1].links).toEqual(new Set(['l1', 'l3', 'l5', 'l6', 'l7', 'l8']));
  });

  it('marque la famille du chemin le plus long comme critique', () => {
    const { families, critical } = overviewOf(incident);
    expect(critical?.duration).toBe(6);
    expect(families.map((family) => family.critical)).toEqual([false, true]);
  });

  it('donne la charge de chaque acteur', () => {
    expect(overviewOf(incident).load[0]).toEqual({ actor: 'Support N1', steps: 2 });
    expect(overviewOf(demandeMateriel).load[0]).toEqual({ actor: 'Responsable', steps: 2 });
  });

  it('fait une seule famille, sans critique, quand rien ne bifurque', () => {
    const ligne: Process = {
      id: 'ligne',
      name: 'Ligne',
      steps: [
        { id: 'a', kind: 'start', title: 'A' },
        { id: 'b', kind: 'end', title: 'B' },
      ],
      links: [{ id: 'l1', from: 'a', to: 'b' }],
    };
    const { families } = overviewOf(ligne);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({ id: 'unique', label: 'Chemin unique', critical: false });
  });

  it('ne tourne pas en rond dans une boucle et s’arrête au plafond', () => {
    const boucle: Process = {
      ...incident,
      links: [...incident.links, { id: 'l9', from: 'escalader', to: 'diagnostiquer', label: 'retour' }],
    };
    expect(allPaths(boucle).paths).toHaveLength(3);
    expect(allPaths(incident, 2)).toMatchObject({ capped: true });
    expect(allPaths(incident, 2).paths).toHaveLength(2);
  });
});
