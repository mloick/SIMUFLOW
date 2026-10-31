/**
 * Les process d'exemple (demo-processes.ts), à part des process de l'utilisateur :
 * la liste les range dans une section « Exemples », repliable. Le réglage qui
 * les masque est dans examples-setting.ts. Fonctions pures, testées.
 */

import type { Process } from '@/domain';

import { demoProcesses } from './demo-processes';

const EXAMPLE_IDS = new Set(demoProcesses.map((process) => process.id));

/** Vrai pour un process d'exemple fourni avec l'app. */
export function isExample(process: Process): boolean {
  return EXAMPLE_IDS.has(process.id);
}

/** Sépare les process de l'utilisateur des exemples, dans le même ordre. */
export function splitExamples(processes: Process[]): { own: Process[]; examples: Process[] } {
  return {
    own: processes.filter((process) => !isExample(process)),
    examples: processes.filter(isExample),
  };
}
