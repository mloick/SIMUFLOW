/**
 * Anonymisation d'un formulaire et de son workflow, avec les mêmes règles que
 * pour un process (src/domain/anonymize.ts) : les groupes et services
 * (propriétaires, groupes de compétence, groupe du ticket, acteurs du process
 * lié) deviennent « Service A », « Service B »… partout, les mots choisis
 * « [masqué] », et les e-mails, téléphones et liens sont masqués. Les mêmes
 * remplacements passent sur le formulaire et sur le workflow : le choix qui
 * mène à une situation garde son lien.
 */

import { anonymizeData, anonymizeProcessWith, distinctNames, textAnonymizer } from '@/domain';
import type { FormTemplate } from '@/import/tableau';

import type { LinkedWorkflow } from './form-store';

export type AnonymousForm = {
  form: FormTemplate;
  workflow: LinkedWorkflow | null;
  /** Applique les mêmes remplacements à un autre texte (le nom du fichier). */
  text: (value: string) => string;
  /** Nombre de groupes et services renommés. */
  actorCount: number;
};

/** Les groupes et services cités par le formulaire et son workflow, dans l'ordre où ils apparaissent. */
export function formActors(form: FormTemplate, workflow: LinkedWorkflow | null): string[] {
  const fromWorkflow =
    workflow?.kind === 'situations'
      ? workflow.situations.flatMap((situation) => [
          situation.owner,
          ...situation.steps.map((step) => step.group),
          situation.closure.group,
        ])
      : workflow?.kind === 'process'
        ? workflow.process.steps.map((step) => step.actor)
        : [];
  return distinctNames([form.assignmentGroup, ...form.tasks.map((task) => task.group), ...fromWorkflow]);
}

export function anonymizeForm(form: FormTemplate, workflow: LinkedWorkflow | null, hidden: string[] = []): AnonymousForm {
  const actors = formActors(form, workflow);
  const text = textAnonymizer(actors, hidden);
  const linked: LinkedWorkflow | null =
    workflow?.kind === 'process'
      ? { kind: 'process', source: text(workflow.source), process: anonymizeProcessWith(workflow.process, text) }
      : workflow
        ? anonymizeData(workflow, text)
        : null;
  return { form: anonymizeData(form, text), workflow: linked, text, actorCount: actors.length };
}
