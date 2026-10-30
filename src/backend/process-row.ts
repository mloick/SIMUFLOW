/**
 * Correspondance entre un process de l'app et une ligne de la table
 * `public.processes` (voir supabase/migrations/). Le process garde ses étapes
 * et ses liens tels quels dans la colonne `content` (JSON).
 */

import type { Link, Process, ProcessSource, Step } from '@/domain';

/** Une ligne de la table, telle que Supabase la renvoie. */
export type ProcessRow = {
  id: string;
  owner_id: string;
  name: string;
  source: ProcessSource | null;
  content: { steps: Step[]; links: Link[] };
  created_at: string;
  updated_at: string;
};

/** Ce que l'app envoie pour créer ou modifier une ligne : la base remplit le reste (id, propriétaire, dates). */
export type ProcessRowInput = Pick<ProcessRow, 'name' | 'source' | 'content'>;

const SOURCES: ProcessSource[] = ['drawio', 'scan', 'json'];

export function toRow(process: Process): ProcessRowInput {
  return {
    name: process.name.trim(),
    source: process.source ?? null,
    content: { steps: process.steps, links: process.links },
  };
}

/** Process lu dans la base. Une ligne mal formée lève une erreur plutôt que de casser un écran plus loin. */
export function fromRow(row: ProcessRow): Process {
  const { content } = row;
  if (!content || !Array.isArray(content.steps) || !Array.isArray(content.links)) {
    throw new Error(`Le process « ${row.name} » est mal enregistré sur le serveur.`);
  }
  return {
    id: row.id,
    name: row.name,
    ...(row.source && SOURCES.includes(row.source) ? { source: row.source } : {}),
    steps: content.steps,
    links: content.links,
  };
}
