/**
 * La suite d'un formulaire rempli : le process de la situation choisie (ou le
 * process lié), ajouté à la liste des process la première fois, puis simulé
 * ou suivi en vrai avec les réponses du formulaire.
 */

import type { DocumentPickerAsset } from 'expo-document-picker';

import type { Process } from '@/domain';
import { ImportError, importProcessFile } from '@/import';
import {
  describeWorkbook,
  findFormLink,
  readFormTemplate,
  readTableFile,
  situationToProcess,
  workbookToProcesses,
  workbookToSituations,
  type AnswerLine,
  type FormTemplate,
} from '@/import/tableau';
import { completeStep, startTracking } from '@/tracking/tracking';
import { readPickedBytes, readPickedFile } from '@/utils/read-file';

import type { LinkedWorkflow, ShownForm } from './form-store';
import { addImportedProcess, getProcess } from './process-store';
import { applyReadingRules, getLearnedHeaders } from './rules-store';
import { saveTracking } from './tracking-store';

/** Le process qui suit le formulaire : celui de la situation `index`, ou le process lié. Créé une seule fois. */
export function processForForm(shown: ShownForm, index: number | null): Process | null {
  const { workflow } = shown;
  if (!workflow) return null;
  let process: Process;
  if (workflow.kind === 'situations') {
    const situation = index !== null ? workflow.situations[index] : undefined;
    if (!situation) return null;
    process = situationToProcess(situation, `${shown.key}-situation-${index! + 1}`);
  } else {
    process = { ...workflow.process, id: `${shown.key}-process` };
  }
  const existing = getProcess(process.id);
  if (existing) return existing;
  addImportedProcess(process);
  return process;
}

/**
 * Commence le suivi en vrai d'une demande faite avec ce formulaire, réponses
 * jointes. Pour une situation, l'étape « remplir le formulaire » est déjà faite.
 */
export function startFormTracking(process: Process, formName: string, lines: AnswerLine[], skipForm: boolean, now = new Date()): string | null {
  const label = `${formName} · ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  let tracking = startTracking(process, now, `suivi-${now.getTime()}`, label);
  if (!tracking) return null;
  tracking = { ...tracking, answers: lines.map(({ label: question, answer }) => ({ label: question, answer })) };
  if (skipForm) tracking = completeStep(process, tracking, now);
  saveTracking(tracking);
  return tracking.id;
}

/** Lit le fichier d'un workflow à lier : un classeur SLA / OLA (ses situations) ou un process (draw.io, JSON, tableau de process). */
export async function readWorkflowFile(asset: DocumentPickerAsset): Promise<LinkedWorkflow> {
  const prefix = `lien-${Date.now()}`;
  if (/\.(xlsx|xlsm|xls|csv)$/i.test(asset.name)) {
    const workbook = readTableFile(asset.name, await readPickedBytes(asset));
    const { situations } = workbookToSituations(workbook);
    if (situations.length > 0) return { kind: 'situations', source: asset.name, situations };
    const read = workbookToProcesses(workbook, prefix, getLearnedHeaders());
    if (read.processes.length > 0) return { kind: 'process', source: asset.name, process: read.processes[0] };
    throw new ImportError('Ce classeur ne contient ni situations SLA / OLA ni tableau de process.');
  }
  const { result } = applyReadingRules(importProcessFile(asset.name, await readPickedFile(asset), prefix));
  return { kind: 'process', source: asset.name, process: result.processes[0] };
}

const TABLE_NAME = /\.(xlsx|xlsm|xls|csv)$/i;

export type FormBundle = { form: FormTemplate; source: string; workflow: LinkedWorkflow | null };

/**
 * Un formulaire et son workflow, choisis ensemble : un seul classeur qui
 * contient les deux, ou deux fichiers (le template, et le workflow en Excel,
 * draw.io ou JSON), dans n'importe quel ordre. Le fichier qui contient un
 * template de formulaire est le formulaire ; l'autre, son workflow.
 */
export async function readFormBundle(assets: DocumentPickerAsset[]): Promise<FormBundle> {
  if (assets.length === 0) throw new ImportError('Choisissez le template du formulaire, et son workflow si vous l’avez.');
  if (assets.length > 2) throw new ImportError('Choisissez deux fichiers au plus : le formulaire et son workflow.');
  let found: { form: FormTemplate; asset: DocumentPickerAsset; workflow: LinkedWorkflow | null } | null = null;
  const others: DocumentPickerAsset[] = [];
  for (const asset of assets) {
    if (!found && TABLE_NAME.test(asset.name)) {
      const workbook = readTableFile(asset.name, await readPickedBytes(asset));
      const { kind } = describeWorkbook(workbook, getLearnedHeaders());
      const form = kind === 'formulaire' || kind === 'formulaire-workflow' ? readFormTemplate(workbook) : null;
      if (form) {
        const { situations } = workbookToSituations(workbook);
        found = { form, asset, workflow: situations.length > 0 ? { kind: 'situations', source: asset.name, situations } : null };
        continue;
      }
    }
    others.push(asset);
  }
  if (!found) {
    throw new ImportError('Aucun de ces fichiers n’est un template de formulaire (un classeur avec un onglet « Questions » ou « Variables »).');
  }
  let { workflow } = found;
  // Un workflow dans un fichier à part passe avant celui du même classeur.
  if (others[0]) workflow = await readWorkflowFile(others[0]);
  if (workflow?.kind === 'situations' && !findFormLink(found.form, workflow.situations)) {
    throw new ImportError(`Aucun choix du formulaire ne porte le nom d’une situation de « ${workflow.source} » : le lien est impossible.`);
  }
  return { form: found.form, source: found.asset.name, workflow };
}
