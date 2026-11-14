/**
 * Point d'entrée de l'import : choisit le bon lecteur selon le fichier.
 */

import { looksLikeBpmn, parseBpmn } from './bpmn';
import { parseDrawio } from './drawio';
import { ImportError, type ImportResult } from './errors';
import { parseProcessJson } from './json';
import { parseProcessText } from './texte';

export { looksLikeBpmn, parseBpmn } from './bpmn';
export { parseDrawio } from './drawio';
export { looksLikeVisio, parseVisio } from './visio';
export { ImportError, type ImportResult } from './errors';
export { parseProcessJson, processToJson } from './json';
export { looksLikeProcessText, parseProcessText } from './texte';
export {
  applyRules,
  describeRule,
  learnColumnRules,
  learnedHeaders,
  learnRules,
  mergeRules,
  parseRules,
  reconcileRules,
  ruleKey,
  shapeName,
  type ReadingRule,
} from './rules';

export function importProcessFile(fileName: string, content: string, idPrefix?: string): ImportResult {
  const text = content.replace(/^﻿/, '').trim();
  if (/\.json$/i.test(fileName) || text.startsWith('{')) return parseProcessJson(text, fileName, idPrefix);
  if (/\.bpmn2?$/i.test(fileName) || looksLikeBpmn(text)) return parseBpmn(text, fileName, idPrefix);
  if (/\.(drawio|xml)$/i.test(fileName) || text.startsWith('<')) return parseDrawio(text, fileName, idPrefix);
  if (/\.(txt|md|text)$/i.test(fileName)) return parseProcessText(text, nameOfFile(fileName), idPrefix);
  throw new ImportError('Format non reconnu : choisissez un fichier .drawio, .bpmn, .xml, .json ou .txt.');
}

/** « demande-materiel.txt » → « demande materiel ». */
function nameOfFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Process';
}
