import { describe, expect, it } from '@jest/globals';

import { countPaths, longestPath, shortestPath, type Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';
import { demoProcesses } from '@/data/demo-processes';
import { briefOf } from '@/export/brief';
import { processToDrawio } from '@/export/drawio';
import { diagramSvg } from '@/export/svg';
import { parseDrawio } from '@/import';
import { modele } from '@/import/__fixtures__/varies';

import { allPaths, overviewOf } from '../families';
import { layoutProcess } from '../layout';
import { complexCase, parallelRuns, pathCount, simpleCase } from '../runs';

/**
 * Facture et colis en même temps ; côté colis, une décision « En stock ? » :
 * non → Commander au fournisseur (5 JO) puis Préparer le colis.
 */
const commande: Process = {
  id: 'commande',
  name: 'Commande',
  steps: [
    { id: 'debut', kind: 'start', title: 'Commande validée' },
    { id: 'partage', kind: 'parallel', title: 'En parallèle' },
    { id: 'facture', kind: 'task', title: 'Préparer la facture', actor: 'Compta', duration: 1 },
    { id: 'stock', kind: 'decision', title: 'En stock ?', actor: 'Logistique' },
    { id: 'fournisseur', kind: 'task', title: 'Commander au fournisseur', actor: 'Logistique', duration: 5 },
    { id: 'colis', kind: 'task', title: 'Préparer le colis', actor: 'Logistique', duration: 3 },
    { id: 'jonction', kind: 'parallel', title: 'Attendre toutes les branches' },
    { id: 'expedier', kind: 'task', title: 'Expédier', actor: 'Logistique', duration: 1 },
    { id: 'fin', kind: 'end', title: 'Commande expédiée' },
  ],
  links: [
    { id: 'l1', from: 'debut', to: 'partage' },
    { id: 'l2', from: 'partage', to: 'facture' },
    { id: 'l3', from: 'partage', to: 'stock' },
    { id: 'oui', from: 'stock', to: 'colis', label: 'oui' },
    { id: 'non', from: 'stock', to: 'fournisseur', label: 'non' },
    { id: 'l4', from: 'fournisseur', to: 'colis' },
    { id: 'l5', from: 'facture', to: 'jonction' },
    { id: 'l6', from: 'colis', to: 'jonction' },
    { id: 'l7', from: 'jonction', to: 'expedier' },
    { id: 'l8', from: 'expedier', to: 'fin' },
  ],
};

const ids = (path: { steps: { stepId: string }[] } | null) => path?.steps.map((step) => step.stepId) ?? [];

describe('chemins avec des tâches en parallèle', () => {
  it('un parcours par sortie de décision, toutes les branches comprises', () => {
    const { paths, capped } = parallelRuns(commande, 100);
    expect(capped).toBe(false);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(ids(path)).toEqual(expect.arrayContaining(['facture', 'colis', 'jonction', 'expedier', 'fin']));
      expect(ids(path).filter((id) => id === 'expedier')).toHaveLength(1);
    }
  });

  it('le délai compte la branche la plus longue', () => {
    expect(simpleCase(commande)?.duration).toBe(4); // max(1, 3) + 1
    expect(complexCase(commande)?.duration).toBe(9); // max(1, 5 + 3) + 1
    expect(ids(complexCase(commande))).toContain('fournisseur');
    expect(ids(simpleCase(commande))).not.toContain('fournisseur');
  });

  it('compte les chemins', () => {
    expect(pathCount(commande)).toEqual({ count: 2, capped: false });
  });

  it('range les chemins en familles par la sortie de la décision, pas par le losange « En parallèle »', () => {
    const overview = overviewOf(commande);
    expect(overview.families.map((family) => family.label)).toEqual(['En stock : oui', 'En stock : non']);
    expect(overview.critical?.duration).toBe(9);
    expect(overview.families.find((family) => family.critical)?.label).toBe('En stock : non');
    // Les flèches des deux branches sont dans chaque famille.
    expect([...overview.families[0].links]).toEqual(expect.arrayContaining(['l2', 'l3', 'l5', 'l6']));
  });

  it('s’arrête sur une boucle au lieu de tourner sans fin', () => {
    // Préparer le colis → Colis conforme ? → non : on le refait.
    const boucle: Process = {
      ...commande,
      steps: [...commande.steps, { id: 'controle', kind: 'decision', title: 'Colis conforme ?' }],
      links: [
        ...commande.links.filter((link) => link.id !== 'l6'),
        { id: 'l6', from: 'colis', to: 'controle' },
        { id: 'conforme', from: 'controle', to: 'jonction', label: 'oui' },
        { id: 'refaire', from: 'controle', to: 'colis', label: 'non' },
      ],
    };
    const { paths, capped } = parallelRuns(boucle, 100);
    expect(capped).toBe(false);
    expect(paths).toHaveLength(2);
    for (const path of paths) expect(ids(path).at(-1)).toBe('fin');
  });
});

describe('process sans tâches en parallèle : mêmes chemins qu’avant', () => {
  it('cas simple, cas complexe, nombre de chemins et familles inchangés', () => {
    for (const process of [demandeMateriel, ...demoProcesses]) {
      expect(simpleCase(process)).toEqual(shortestPath(process));
      expect(complexCase(process)).toEqual(longestPath(process));
      expect(pathCount(process)).toEqual(countPaths(process));
      expect(overviewOf(process).pathCount).toBe(allPaths(process).paths.length);
    }
  });
});

describe('PDF et draw.io avec des tâches en parallèle', () => {
  it('dessine les losanges « En parallèle » en vert dans le PDF', () => {
    const svg = diagramSvg(layoutProcess(commande));
    expect(svg).toContain('fill="#e2f5ee" stroke="#0b6b4b"');
  });

  it('l’« En bref » le dit, sans compter les losanges comme des étapes', () => {
    const brief = briefOf(commande, overviewOf(commande));
    expect(brief.intro.join(' ')).toContain('se font en même temps');
    expect(brief.intro.join(' ')).toContain('la branche la plus longue');
  });

  it('l’export draw.io marque les étapes en parallèle et se réimporte sans perte', () => {
    const xml = processToDrawio(commande, layoutProcess(commande));
    expect(xml).toContain('parallele="1"');
    const [back] = parseDrawio(xml, 'Commande.drawio').processes;
    const kindOf = (title: string) => back.steps.find((step) => step.title === title)?.kind;
    expect(kindOf('En parallèle')).toBe('parallel');
    expect(kindOf('Attendre toutes les branches')).toBe('parallel');
    expect(kindOf('En stock ?')).toBe('decision');
  });

  it('l’import draw.io ne lit du parallèle que sur un losange « + » ou « En parallèle »', () => {
    const losange = 'rhombus;whiteSpace=wrap;html=1;';
    const xml = (texte: string) =>
      modele(
        [
          { id: 'a', texte: 'Début', style: 'ellipse;', x: 0, y: 0 },
          { id: 'p', texte, style: losange, x: 200, y: 0 },
          { id: 'b', texte: 'Facture', x: 400, y: 0 },
          { id: 'c', texte: 'Colis', x: 400, y: 100 },
          { id: 'f', texte: 'Fin', style: 'ellipse;', x: 600, y: 0 },
        ],
        [
          ['a', 'p'],
          ['p', 'b'],
          ['p', 'c'],
          ['b', 'f'],
          ['c', 'f'],
        ],
      );
    const kind = (texte: string) =>
      parseDrawio(xml(texte), 'test.drawio').processes[0].steps.find((step) => step.id === 'p')?.kind;
    expect(kind('+')).toBe('parallel');
    expect(kind('En parallèle')).toBe('parallel');
    expect(kind('en parallele')).toBe('parallel');
    // Rien n'est deviné : un losange avec une question reste une décision.
    expect(kind('Urgent ?')).toBe('decision');
    expect(kind('Plus de 500 € ?')).toBe('decision');
  });
});
