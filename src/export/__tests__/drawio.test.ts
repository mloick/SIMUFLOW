import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';
import { parseDrawio } from '@/import';
import { FICHIER_CONGES } from '@/import/__fixtures__/conges';
import { overviewOf, paintFamilies } from '@/simulation/families';
import { layoutProcess } from '@/simulation/layout';

import { processToDrawio } from '../drawio';

/** Ce qui doit survivre à un aller-retour : étapes et liens, sans les identifiants ni les positions. */
function essentials(process: Process) {
  const title = new Map(process.steps.map((step) => [step.id, step.title]));
  return {
    steps: process.steps
      .map(({ kind, title: name, actor, duration }) => ({ kind, title: name, actor, duration }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    links: process.links
      .map((link) => `${title.get(link.from)} → ${title.get(link.to)}${link.label ? ` (${link.label})` : ''}`)
      .sort(),
  };
}

const roundTrip = (process: Process, xml = processToDrawio(process, layoutProcess(process))) =>
  parseDrawio(xml, `${process.name}.drawio`).processes[0];

describe('export draw.io', () => {
  it('se réimporte sans perte : étapes, acteurs, délais, sorties', () => {
    expect(essentials(roundTrip(demandeMateriel))).toEqual(essentials(demandeMateriel));
  });

  it('range les étapes dans un couloir par acteur', () => {
    const xml = processToDrawio(demandeMateriel, layoutProcess(demandeMateriel));
    expect(xml.match(/style="swimlane;/g)).toHaveLength(5);
    expect(xml).toContain('value="Achats"');
  });

  it('garde l’acteur sans couloir, pour un process venu de draw.io', () => {
    const original = parseDrawio(FICHIER_CONGES, 'conges.drawio').processes[0];
    expect(layoutProcess(original).lanes).toHaveLength(0);
    expect(essentials(roundTrip(original))).toEqual(essentials(original));
  });

  it('échappe les caractères spéciaux', () => {
    const process: Process = {
      ...demandeMateriel,
      name: 'Achats & <test>',
      steps: demandeMateriel.steps.map((step) =>
        step.id === 'commande' ? { ...step, title: 'Commander <vite> & "bien"' } : step,
      ),
    };
    expect(roundTrip(process).steps.map((step) => step.title)).toContain('Commander <vite> & "bien"');
  });

  it('colore les flèches selon leur famille', () => {
    const colors = ['#111111', '#222222'];
    const strokes = paintFamilies(overviewOf(demandeMateriel), colors).strokes;
    const xml = processToDrawio(demandeMateriel, layoutProcess(demandeMateriel), { strokes });
    expect(xml).toMatch(/id="lien-l2"[^>]*strokeColor=#111111;strokeWidth=4/);
    expect(xml).toMatch(/id="lien-l3"[^>]*strokeColor=#222222;strokeWidth=2/);
    expect(xml).toMatch(/id="lien-l1"[^>]*strokeColor=#4a5b70/);
  });
});
