import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';
import { demoProcesses } from '@/data/demo-processes';
import { importProcessFile } from '@/import';
import { FICHIER_CONGES } from '@/import/__fixtures__/conges';

import { borderPoint, computeRanks, layoutProcess, midpoint, NODE_WIDTH, offsetPolyline } from '../layout';

const boucle: Process = {
  id: 'boucle',
  name: 'Boucle',
  steps: [
    { id: 'a', kind: 'start', title: 'Début', actor: 'Équipe A' },
    { id: 'b', kind: 'task', title: 'Préparer', actor: 'Équipe A' },
    { id: 'c', kind: 'decision', title: 'Complet ?', actor: 'Équipe B' },
    { id: 'd', kind: 'end', title: 'Fin', actor: 'Équipe B' },
  ],
  links: [
    { id: 'l1', from: 'a', to: 'b' },
    { id: 'l2', from: 'b', to: 'c' },
    { id: 'l3', from: 'c', to: 'd', label: 'oui' },
    { id: 'l4', from: 'c', to: 'b', label: 'non' },
  ],
};

describe('mise en page automatique', () => {
  it('range les étapes par niveau, sans compter les boucles', () => {
    expect(Object.fromEntries(computeRanks(boucle))).toEqual({ a: 0, b: 1, c: 2, d: 3 });
  });

  it('fait un couloir par acteur et place chaque étape dans le sien', () => {
    const layout = layoutProcess(boucle);
    expect(layout.source).toBe('auto');
    expect(layout.lanes.map((lane) => lane.label)).toEqual(['Équipe A', 'Équipe B']);
    const [laneA, laneB] = layout.lanes;
    const b = layout.nodes.get('b')!;
    const c = layout.nodes.get('c')!;
    expect(b.x).toBeGreaterThanOrEqual(laneA.x);
    expect(b.x + NODE_WIDTH).toBeLessThanOrEqual(laneA.x + laneA.width);
    expect(c.x).toBeGreaterThanOrEqual(laneB.x);
    expect(c.y).toBeGreaterThan(b.y);
  });

  it('fait remonter la boucle par le côté', () => {
    const retour = layoutProcess(boucle).edges.find((edge) => edge.id === 'l4')!;
    expect(retour.points).toHaveLength(4);
    expect(retour.points[1].y).toBe(retour.points[0].y);
    expect(retour.points[2].y).toBe(retour.points[3].y);
  });

  it('met côte à côte deux étapes d’un même niveau et d’un même acteur', () => {
    const layout = layoutProcess({
      ...demandeMateriel,
      steps: demandeMateriel.steps.map((step) => ({ ...step, actor: undefined })),
    });
    expect(layout.lanes).toEqual([]);
    const commande = layout.nodes.get('commande')!;
    const refus = layout.nodes.get('refus')!;
    expect(commande.y).toBe(refus.y);
    expect(commande.x).not.toBe(refus.x);
    for (const node of layout.nodes.values()) {
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe('mise en page draw.io', () => {
  it('garde les positions du fichier', () => {
    const process = importProcessFile('conges.drawio', FICHIER_CONGES).processes[0];
    const layout = layoutProcess(process);
    expect(layout.source).toBe('drawio');
    const debut = process.steps.find((step) => step.title === 'Début')!;
    const saisir = process.steps.find((step) => step.title === 'Saisir la demande')!;
    const a = layout.nodes.get(debut.id)!;
    const b = layout.nodes.get(saisir.id)!;
    expect(b.x - a.x).toBe(saisir.layout!.x - debut.layout!.x);
    expect(layout.edges.length).toBe(process.links.length);
  });
});

describe('géométrie', () => {
  const box = { id: 'x', kind: 'task' as const, title: '', x: 0, y: 0, width: 100, height: 50 };

  it('trouve le bord d’un rectangle et d’un losange', () => {
    expect(borderPoint(box, { x: 50, y: 200 })).toEqual({ x: 50, y: 50 });
    expect(borderPoint({ ...box, kind: 'decision' }, { x: 300, y: 25 })).toEqual({ x: 100, y: 25 });
  });

  it('trouve le milieu d’une ligne brisée', () => {
    expect(
      midpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });
});

describe('traits côte à côte', () => {
  it('décale une ligne brisée sans casser ses coins', () => {
    // Vers la droite, puis vers le bas : décalé de 4 vers la gauche de la marche.
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(offsetPolyline(points, 4)).toEqual([
      { x: 0, y: -4 },
      { x: 14, y: -4 },
      { x: 14, y: 10 },
    ]);
    expect(offsetPolyline(points, 0)).toBe(points);
  });
});

describe('tracé des flèches', () => {
  const traverse = (process: Process) => {
    const layout = layoutProcess(process);
    const problems: string[] = [];
    for (const edge of layout.edges) {
      edge.points.slice(1).forEach((q, i) => {
        const p = edge.points[i];
        for (const node of layout.nodes.values()) {
          if (node.id === edge.from || node.id === edge.to) continue;
          const inside =
            Math.max(p.x, q.x) > node.x &&
            Math.min(p.x, q.x) < node.x + node.width &&
            Math.max(p.y, q.y) > node.y &&
            Math.min(p.y, q.y) < node.y + node.height;
          if (inside) problems.push(`${edge.from} → ${edge.to} traverse ${node.id}`);
        }
      });
    }
    return problems;
  };

  it.each(demoProcesses.map((process) => [process.name, process] as const))(
    'ne traverse aucune étape : %s',
    (_, process) => {
      expect(traverse(process)).toEqual([]);
    },
  );

  it('ne traverse aucune étape : exemple de test', () => {
    expect(traverse(demandeMateriel)).toEqual([]);
    expect(traverse(boucle)).toEqual([]);
  });

  it('fait arriver deux flèches sur une même étape en deux points distincts', () => {
    const acces = demoProcesses.find((process) => process.id === 'demande-acces')!;
    const edges = layoutProcess(acces).edges.filter((edge) => edge.to === 'fin');
    expect(edges).toHaveLength(2);
    const [a, b] = edges.map((edge) => edge.points[edge.points.length - 1]);
    expect(a.x).not.toBe(b.x);
  });

  it('écarte deux flèches qui passent dans le même couloir', () => {
    for (const process of demoProcesses) {
      // Segments horizontaux de chaque flèche, sauf le dernier (l'arrivée).
      const rows = layoutProcess(process).edges.flatMap((edge) =>
        edge.points
          .slice(0, -2)
          .map((p, i) => ({ id: edge.id, p, q: edge.points[i + 1] }))
          .filter(({ p, q }) => Math.abs(p.y - q.y) < 0.5),
      );
      for (const s of rows) {
        for (const t of rows) {
          if (s.id === t.id || Math.abs(s.p.y - t.p.y) > 0.5) continue;
          const overlap =
            Math.min(Math.max(s.p.x, s.q.x), Math.max(t.p.x, t.q.x)) -
            Math.max(Math.min(s.p.x, s.q.x), Math.min(t.p.x, t.q.x));
          expect(overlap).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });
});
