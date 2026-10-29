/**
 * Format JSON de SimuFlow : un process tel quel, pour sauvegarder, partager ou
 * écrire un process à la main.
 *
 *   { "format": "simuflow", "version": 1, "name": "…",
 *     "steps": [{ "id": "…", "kind": "start", "title": "…", "actor": "…", "duration": 2 }],
 *     "links": [{ "from": "…", "to": "…", "label": "oui" }] }
 *
 * Chaque erreur dit où elle se trouve (« Étape 3 : … ») pour être corrigée.
 */

import type { Link, Process, Step, StepKind } from '@/domain';

import { ImportError, type ImportResult } from './errors';

const KINDS: StepKind[] = ['start', 'task', 'decision', 'end'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseProcessJson(text: string, fileName: string, idPrefix = 'json'): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Ce fichier n’est pas un JSON valide.');
  }
  if (!isObject(data)) throw new ImportError('Le fichier doit contenir un objet process.');
  if (data.format !== undefined && data.format !== 'simuflow') {
    throw new ImportError('Ce JSON n’est pas un process SimuFlow (champ « format »).');
  }
  if (!Array.isArray(data.steps) || data.steps.length === 0) throw new ImportError('Le process ne contient aucune étape.');

  const ids = new Set<string>();
  const steps: Step[] = data.steps.map((raw, index) => {
    const where = `Étape ${index + 1}`;
    if (!isObject(raw)) throw new ImportError(`${where} : format incorrect.`);
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
    if (!id) throw new ImportError(`${where} : identifiant (« id ») manquant.`);
    if (ids.has(id)) throw new ImportError(`${where} : l’identifiant « ${id} » est déjà utilisé.`);
    ids.add(id);
    const kind = raw.kind ?? 'task';
    if (!KINDS.includes(kind as StepKind)) {
      throw new ImportError(`${where} : rôle « ${String(kind)} » inconnu (start, task, decision ou end).`);
    }
    const step: Step = { id, kind: kind as StepKind, title: typeof raw.title === 'string' ? raw.title : '' };
    if (typeof raw.actor === 'string' && raw.actor.trim()) step.actor = raw.actor.trim();
    if (raw.duration !== undefined) {
      if (typeof raw.duration !== 'number' || !(raw.duration >= 0)) throw new ImportError(`${where} : délai invalide.`);
      step.duration = raw.duration;
    }
    return step;
  });

  const rawLinks = data.links ?? [];
  if (!Array.isArray(rawLinks)) throw new ImportError('Le champ « links » doit être une liste.');
  const links: Link[] = rawLinks.map((raw, index) => {
    const where = `Lien ${index + 1}`;
    if (!isObject(raw) || raw.from === undefined || raw.to === undefined) {
      throw new ImportError(`${where} : il faut « from » et « to ».`);
    }
    const link: Link = { id: typeof raw.id === 'string' ? raw.id : `l${index + 1}`, from: String(raw.from), to: String(raw.to) };
    if (typeof raw.label === 'string' && raw.label.trim()) link.label = raw.label.trim();
    return link;
  });

  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fileName.replace(/\.json$/i, '');
  return { processes: [{ id: `${idPrefix}-1`, name, source: 'json', steps, links }], warnings: [] };
}

/** Process → texte JSON au format SimuFlow (pour l'exporter ou le partager). */
export function processToJson(process: Process): string {
  return JSON.stringify(
    {
      format: 'simuflow',
      version: 1,
      name: process.name,
      steps: process.steps.map(({ layout: _layout, ...step }) => step),
      links: process.links,
    },
    null,
    2,
  );
}
