import { describe, expect, it } from '@jest/globals';

import { overviewOf } from '@/simulation/families';

import { lireExemple } from '../../../../jest/lire-exemple';
import {
  readTableFile,
  situationLevel,
  situationName,
  situationsToProcesses,
  situationToProcess,
  workbookToSituations,
  type Situation,
} from '..';

const { situations } = workbookToSituations(readTableFile('workflow-sla-ola.xlsx', lireExemple('workflow-sla-ola.xlsx')));
const byLabel = (label: string) => situations.find((situation) => situation.label === label)!;

/** « Titre → Titre (Oui) » pour chaque lien, pour lire le parcours en clair. */
const route = (situation: Situation) => {
  const process = situationToProcess(situation, 'x');
  const title = (id: string) => process.steps.find((step) => step.id === id)!.title;
  return process.links.map((link) => `${title(link.from)} → ${title(link.to)}${link.label ? ` (${link.label})` : ''}`);
};

describe('process d’une situation', () => {
  it('suit le tronc commun puis l’escalade (Cas 1 de la spécification)', () => {
    const process = situationToProcess(byLabel('Cas 1'), 'x');
    expect(process).toMatchObject({ id: 'x-1', name: 'Famille X · Cas 1', source: 'tableau' });
    expect(process.steps.map(({ kind, title, actor, duration }) => [kind, title, actor, duration])).toEqual([
      ['start', 'Choisir la situation et remplir le formulaire', 'Demandeur', undefined],
      ['task', 'Ticket créé et attribué au propriétaire (SLA 6 JO)', 'Service P', undefined],
      ['task', 'Task 1 : Fournir le document (OLA 1 : 3 JO)', 'Groupe A', 3],
      ['decision', 'Réponse dans l’OLA 1 ?', 'Groupe A', undefined],
      ['decision', 'Task 1 résolue ?', 'Groupe A', undefined],
      ['task', 'Task 1 résolue (solved)', 'Groupe A', undefined],
      ['task', 'Task 1 non résolue (not solved ou sans réponse)', 'Groupe A', undefined],
      ['task', 'Task 2 : Fournir le document (OLA 2 : 3 JO)', 'Groupe B', 3],
      ['decision', 'Réponse dans l’OLA 2 ?', 'Groupe B', undefined],
      ['decision', 'Task 2 résolue ?', 'Groupe B', undefined],
      ['task', 'Task 2 résolue (solved)', 'Groupe B', undefined],
      ['task', 'Task 2 non résolue (not solved ou sans réponse)', 'Groupe B', undefined],
      ['end', 'Ticket clôturé par le propriétaire', 'Service P', undefined],
    ]);
    expect(route(byLabel('Cas 1'))).toEqual(
      expect.arrayContaining([
        'Réponse dans l’OLA 1 ? → Task 1 non résolue (not solved ou sans réponse) (Non)',
        'Task 1 non résolue (not solved ou sans réponse) → Task 2 : Fournir le document (OLA 2 : 3 JO)',
        'Task 1 résolue (solved) → Ticket clôturé par le propriétaire',
      ]),
    );
  });

  it('se simule : le chemin le plus long est OLA 1 + OLA 2', () => {
    const overview = overviewOf(situationToProcess(byLabel('Cas 1'), 'x'));
    expect(overview.critical?.duration).toBe(6);
    expect(overview.pathCount).toBeGreaterThan(1);
  });

  it('une étape : résolue ou non, clôture', () => {
    const lines = route(byLabel('Cas 2'));
    expect(lines).toContain('Task 1 résolue (solved) → Ticket clôturé par le propriétaire');
    expect(lines).toContain('Task 1 non résolue (not solved ou sans réponse) → Ticket clôturé par le propriétaire');
    expect(lines.some((line) => line.includes('Task 2'))).toBe(false);
  });

  it('étape 2 si accord : la task 2 suit la task 1 résolue', () => {
    const lines = route(byLabel('Cas 3'));
    expect(lines).toContain("Task 1 résolue (solved) → Task 2 : Préparer le versement (OLA 2 : 5 JO)");
    expect(lines).toContain('Task 1 non résolue (not solved ou sans réponse) → Ticket clôturé par le propriétaire');
  });

  it('reprise en main : pas de task 2 inventée', () => {
    const lines = route(byLabel('Cas 5'));
    expect(lines).toContain('Task 1 non résolue (not solved ou sans réponse) → Le propriétaire reprend la main');
    expect(lines).toContain('Le propriétaire reprend la main → Ticket clôturé par le propriétaire');
    expect(lines.some((line) => line.includes('Task 2'))).toBe(false);
  });

  it('cas complexe : une décision avant la task 2', () => {
    const lines = route(byLabel('Cas 6'));
    expect(lines).toContain('Task 1 non résolue (not solved ou sans réponse) → Cas complexe ?');
    expect(lines).toContain('Cas complexe ? → Task 2 : Revoir la clause (OLA 2 : 3 JO) (Oui)');
    expect(lines).toContain('Cas complexe ? → Ticket clôturé par le propriétaire (Non)');
  });

  it('signale l’assignee manuel et garde un process sans SLA ni groupe', () => {
    expect(situationToProcess(byLabel('Cas 4'), 'x').steps[2].title).toMatch(/assignee à renseigner à la main$/);
    const bare: Situation = { ...byLabel('Cas 2'), owner: null, slaDays: null, closure: { group: null, always: true }, steps: [] };
    const process = situationToProcess(bare, 'x');
    expect(process.steps[1]).toEqual({ id: 'x-s2', kind: 'task', title: 'Ticket créé et attribué au propriétaire' });
    expect(process.steps[2].title).toBe('Task 1');
  });
});

describe('situations du classeur', () => {
  it('donne un process par situation, avec des identifiants uniques', () => {
    const { processes } = situationsToProcesses(situations, 'imp');
    expect(processes.map((process) => process.name)).toEqual([
      'Famille X · Cas 1',
      'Famille X · Cas 2',
      'Famille X · Cas 3',
      'Famille Y · Cas 4',
      'Famille Z · Cas 5',
      'Famille Z · Cas 6',
    ]);
    expect(new Set(processes.flatMap((process) => process.steps.map((step) => step.id))).size).toBe(
      processes.reduce((count, process) => count + process.steps.length, 0),
    );
  });

  it('classe chaque situation par son avertissement le plus grave', () => {
    expect(situations.map((situation) => situationLevel(situation.warnings))).toEqual([null, 'orange', null, 'orange', 'orange', 'orange']);
    expect(situationLevel([{ level: 'info', message: 'marge' }])).toBe('info');
    expect(situationLevel([{ level: 'info', message: 'a' }, { level: 'rouge', message: 'b' }])).toBe('rouge');
  });

  it('nomme la situation sans répéter la famille', () => {
    expect(situationName({ ...byLabel('Cas 1'), family: 'Cas 1' })).toBe('Cas 1');
  });
});
