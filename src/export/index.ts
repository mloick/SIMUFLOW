/**
 * Export d'un process : PDF (page HTML que expo-print imprime), draw.io, BPMN
 * ou JSON. Ce module prépare le contenu ; src/utils/share-file.ts l'enregistre et
 * ouvre la feuille de partage du téléphone.
 */

import type { Process } from '@/domain';
import { processToJson } from '@/import';
import { overviewOf, paintFamilies } from '@/simulation/families';
import { layoutProcess } from '@/simulation/layout';

import { processToBpmn } from './bpmn';
import { processToDrawio } from './drawio';

export { processToBpmn } from './bpmn';
export { processToDrawio } from './drawio';
export { processToPdfHtml } from './pdf';
export { diagramSvg } from './svg';

export type ExportFormat = 'pdf' | 'drawio' | 'bpmn' | 'json';

export const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  drawio: 'application/vnd.jgraph.mxfile',
  bpmn: 'application/xml',
  json: 'application/json',
};

/** Nom de fichier tiré du nom du process : « Demande d’accès » → « demande-d-acces.drawio ». */
export function exportFileName(process: Process, format: ExportFormat): string {
  const base =
    process.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'process';
  return `${base}.${format}`;
}

/** Contenu d'un export texte (draw.io, BPMN ou JSON). */
export function exportText(
  process: Process,
  format: 'drawio' | 'bpmn' | 'json',
  options: { colorFamilies: boolean; colors: readonly string[] },
): string {
  if (format === 'json') return processToJson(process);
  if (format === 'bpmn') return processToBpmn(process);
  const strokes = options.colorFamilies ? paintFamilies(overviewOf(process), options.colors).strokes : undefined;
  return processToDrawio(process, layoutProcess(process), { strokes });
}
