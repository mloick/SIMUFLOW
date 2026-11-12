/**
 * La suite d'un formulaire rempli : le process de la situation choisie (ou le
 * process lié), ajouté à la liste des process la première fois, puis simulé
 * ou suivi en vrai avec les réponses du formulaire.
 */

import type { DocumentPickerAsset } from 'expo-document-picker';

import type { Process } from '@/domain';
import { ImportError, importProcessFile } from '@/import';
import {
  readTableFile,
  situationToProcess,
  workbookToProcesses,
  workbookToSituations,
  type AnswerLine,
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
