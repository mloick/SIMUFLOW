import { describe, expect, it } from '@jest/globals';
import { DOMParser } from '@xmldom/xmldom';

import type { Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';
import { importProcessFile, parseBpmn } from '@/import';

import { lireExemple } from '../../../jest/lire-exemple';
import { exportFileName, exportText, processToBpmn } from '..';

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

const roundTrip = (process: Process) => parseBpmn(processToBpmn(process), 'x.bpmn').processes[0];

describe('export BPMN', () => {
  it('se réimporte sans perte : étapes, acteurs, délais, branches, nom', () => {
    const back = roundTrip(demandeMateriel);
    expect(essentials(back)).toEqual(essentials(demandeMateriel));
    expect(back.name).toBe(demandeMateriel.name);
  });

  it('écrit un XML bien formé, avec un pool, un couloir par acteur et le dessin de chaque élément', () => {
    const xml = processToBpmn(demandeMateriel);
    const errors: string[] = [];
    const doc = new DOMParser({ onError: (level, message) => level !== 'warning' && errors.push(message) }).parseFromString(
      xml,
      'text/xml',
    );
    expect(errors).toEqual([]);
    const count = (name: string) => doc.getElementsByTagName(name).length;
    // Un couloir par acteur, plus un couloir sans nom pour les étapes sans acteur.
    const actors = new Set(demandeMateriel.steps.map((step) => step.actor ?? ''));
    expect(count('bpmn:participant')).toBe(1);
    expect(count('bpmn:lane')).toBe(actors.size);
    expect(count('bpmn:sequenceFlow')).toBe(demandeMateriel.links.length);
    expect(count('bpmndi:BPMNShape')).toBe(1 + actors.size + demandeMateriel.steps.length);
    expect(count('bpmndi:BPMNEdge')).toBe(demandeMateriel.links.length);
    expect(count('bpmn:startEvent')).toBe(1);
    expect(count('bpmn:exclusiveGateway')).toBe(demandeMateriel.steps.filter((step) => step.kind === 'decision').length);
    // Le délai est lisible dans tous les outils, et exact pour SimuFlow.
    expect(xml).toMatch(/name="[^"]+ \(\d+ JO\)" simuflow:titre="[^"]+" simuflow:duree="\d+"/);
  });

  it('garde le genre des éléments d’un fichier BPMN importé, et repasse par l’import sans perte', () => {
    const original = importProcessFile('demande-achat.bpmn', new TextDecoder().decode(lireExemple('demande-achat.bpmn'))).processes[0];
    const xml = processToBpmn(original);
    expect(xml).toContain('<bpmn:userTask');
    expect(xml).toContain('<bpmn:serviceTask');
    expect(xml).toContain('<bpmn:intermediateCatchEvent');
    expect(xml).toContain('<bpmn:parallelGateway');
    expect(essentials(roundTrip(original))).toEqual(essentials(original));
  });

  it('sans acteur, ne dessine pas de couloir ; une étape sans acteur va dans un couloir sans nom', () => {
    const bare: Process = {
      id: 'p',
      name: 'Essai <simple> & court',
      steps: [
        { id: 'a', kind: 'start', title: 'Début' },
        { id: 'b', kind: 'task', title: 'Faire', duration: 1.5 },
        { id: 'c', kind: 'end', title: 'Fin' },
      ],
      links: [
        { id: 'l1', from: 'a', to: 'b' },
        { id: 'l2', from: 'b', to: 'c' },
        { id: 'l3', from: 'b', to: 'b', label: 'encore' },
      ],
    };
    const xml = processToBpmn(bare);
    expect(xml).not.toContain('<bpmn:lane');
    expect(xml).toContain('name="Essai &lt;simple&gt; &amp; court"');
    expect(essentials(roundTrip(bare))).toEqual(essentials(bare));

    const mixed = { ...bare, steps: bare.steps.map((step) => (step.id === 'b' ? { ...step, actor: 'Équipe A' } : step)) };
    expect(processToBpmn(mixed).match(/<bpmn:lane /g)).toHaveLength(2);
    expect(essentials(roundTrip(mixed))).toEqual(essentials(mixed));
  });

  it('se nomme et se choisit comme les autres formats', () => {
    expect(exportFileName(demandeMateriel, 'bpmn')).toMatch(/\.bpmn$/);
    expect(exportText(demandeMateriel, 'bpmn', { colorFamilies: true, colors: [] })).toContain('<bpmn:definitions');
  });
});
