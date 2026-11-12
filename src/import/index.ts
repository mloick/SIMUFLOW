/**
 * Point d'entrée de l'import : choisit le bon lecteur selon le fichier.
 */

import { looksLikeBpmn, parseBpmn } from './bpmn';
import { parseDrawio } from './drawio';
import { ImportError, type ImportResult } from './errors';
import { parseProcessJson } from './json';

export { looksLikeBpmn, parseBpmn } from './bpmn';
export { parseDrawio } from './drawio';
export { ImportError, type ImportResult } from './errors';
export { parseProcessJson, processToJson } from './json';
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
  throw new ImportError('Format non reconnu : choisissez un fichier .drawio, .bpmn, .xml ou .json.');
}
