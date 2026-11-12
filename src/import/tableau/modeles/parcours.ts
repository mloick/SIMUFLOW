/**
 * Du modèle normalisé d'une situation (workflow avec SLA et OLA) au process
 * SimuFlow : un parcours prêt à simuler, toujours dans le même ordre.
 *
 * 1. Le demandeur choisit la situation et remplit le formulaire.
 * 2. Le ticket est créé et attribué au propriétaire : le SLA démarre.
 * 3. Task 1, créée automatiquement pour le groupe 1, avec l'OLA 1 pour délai.
 * 4. « Réponse dans l'OLA 1 ? » : non, la task n'est pas résolue (pas de
 *    réponse = non résolue) ; oui, « Task 1 résolue ? » oui ou non.
 * 5. La suite dépend de la variante (escalade, étape 2 si accord, reprise en
 *    main, étape 2 si cas complexe), puis la clôture, toujours par le
 *    propriétaire.
 *
 * Fonctions pures, testées dans __tests__/parcours.test.ts.
 */

import type { Link, Process, Step } from '@/domain';
import type { ImportResult } from '@/import/errors';

import type { Situation, SituationWarning, WarningLevel, WorkflowStep } from './sla-ola';

/** Le nom du process : « Famille · Situation ». */
export function situationName(situation: Situation): string {
  return situation.family && situation.family !== situation.label ? `${situation.family} · ${situation.label}` : situation.label;
}

const days = (value: number) => `${String(value).replace('.', ',')} JO`;

/** Le process d'une situation. `idPrefix` rend les identifiants uniques. */
export function situationToProcess(situation: Situation, idPrefix: string): Process {
  const steps: Step[] = [];
  const links: Link[] = [];
  const owner = situation.owner ?? situation.closure.group ?? undefined;
  const closer = situation.closure.group ?? situation.owner ?? undefined;

  const add = (kind: Step['kind'], title: string, extra: Partial<Step> = {}): string => {
    const id = `${idPrefix}-s${steps.length + 1}`;
    steps.push({ id, kind, title, ...extra });
    return id;
  };
  const link = (from: string, to: string, label?: string) => {
    links.push({ id: `${idPrefix}-l${links.length + 1}`, from, to, ...(label ? { label } : {}) });
  };

  const request = add('start', 'Choisir la situation et remplir le formulaire', { actor: 'Demandeur' });
  const created = add(
    'task',
    situation.slaDays !== null ? `Ticket créé et attribué au propriétaire (SLA ${days(situation.slaDays)})` : 'Ticket créé et attribué au propriétaire',
    owner ? { actor: owner } : {},
  );
  link(request, created);

  /** Une task, sa réponse dans l'OLA et son résultat ; renvoie les deux issues. */
  const task = (step: WorkflowStep) => {
    const title = [`Task ${step.n}${step.task ? ` : ${step.task}` : ''}`];
    if (step.olaDays !== null) title.push(`(OLA ${step.n} : ${days(step.olaDays)})`);
    if (step.manualAssignee) title.push('· assignee à renseigner à la main');
    const id = add('task', title.join(' '), {
      ...(step.group ? { actor: step.group } : {}),
      ...(step.olaDays !== null ? { duration: step.olaDays } : {}),
    });
    const answered = add('decision', `Réponse dans l’OLA ${step.n} ?`, step.group ? { actor: step.group } : {});
    const solvedQuestion = add('decision', `Task ${step.n} résolue ?`, step.group ? { actor: step.group } : {});
    const solved = add('task', `Task ${step.n} résolue (solved)`, step.group ? { actor: step.group } : {});
    const notSolved = add('task', `Task ${step.n} non résolue (not solved ou sans réponse)`, step.group ? { actor: step.group } : {});
    link(id, answered);
    link(answered, solvedQuestion, 'Oui');
    link(answered, notSolved, 'Non');
    link(solvedQuestion, solved, 'Oui');
    link(solvedQuestion, notSolved, 'Non');
    return { id, solved, notSolved };
  };

  const first = situation.steps[0] ?? { n: 1, group: null, task: null, olaDays: null, manualAssignee: false, note: null, condition: null };
  const second = situation.steps[1];
  const one = task(first);
  link(created, one.id);

  const ends: string[] = [];
  const toSecond = (from: string, label?: string) => {
    if (!second) {
      ends.push(from);
      return;
    }
    const two = task(second);
    link(from, two.id, label);
    ends.push(two.solved, two.notSolved);
  };

  switch (situation.variant) {
    case 'escalation':
      ends.push(one.solved);
      toSecond(one.notSolved);
      break;
    case 'conditional_step2':
      ends.push(one.notSolved);
      toSecond(one.solved);
      break;
    case 'complex_escalation': {
      ends.push(one.solved);
      const complex = add('decision', 'Cas complexe ?', owner ? { actor: owner } : {});
      link(one.notSolved, complex);
      toSecond(complex, 'Oui');
      ends.push(complex);
      break;
    }
    case 'takeover': {
      const takeover = add('task', 'Le propriétaire reprend la main', owner ? { actor: owner } : {});
      link(one.solved, takeover);
      link(one.notSolved, takeover);
      ends.push(takeover);
      break;
    }
    default:
      ends.push(one.solved, one.notSolved);
  }

  const closure = add('end', 'Ticket clôturé par le propriétaire', closer ? { actor: closer } : {});
  for (const from of ends) {
    // « Cas complexe ? » non : clôture directe.
    link(from, closure, steps.find((step) => step.id === from)?.title === 'Cas complexe ?' ? 'Non' : undefined);
  }

  return { id: `${idPrefix}-1`, name: situationName(situation), source: 'tableau', steps, links };
}

/** Le niveau le plus grave des avertissements d'une situation ; `null` : lue sans ambiguïté. */
export function situationLevel(warnings: SituationWarning[]): WarningLevel | null {
  if (warnings.some((warning) => warning.level === 'rouge')) return 'rouge';
  if (warnings.some((warning) => warning.level === 'orange')) return 'orange';
  if (warnings.some((warning) => warning.level === 'info')) return 'info';
  return null;
}

/** Un process par situation, dans l'ordre des situations. */
export function situationsToProcesses(situations: Situation[], idPrefix: string): ImportResult {
  return {
    processes: situations.map((situation, index) => situationToProcess(situation, `${idPrefix}-${index + 1}`)),
    warnings: [],
  };
}
