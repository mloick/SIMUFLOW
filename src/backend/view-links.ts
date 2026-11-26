/**
 * Liens de consultation : montrer un formulaire, un workflow, ou un formulaire
 * et son workflow à quelqu'un qui n'a pas de compte (voir
 * supabase/migrations/20261126000000_liens_consultation.sql).
 *
 * Le lien garde une COPIE prise à sa création : modifier le formulaire ou le
 * process ensuite ne change pas le lien. La page du lien est en lecture seule :
 * rien de ce que la personne tape n'est envoyé.
 */

import { SITE_URL } from '@/constants/links';
import type { LinkedWorkflow } from '@/data/form-store';
import type { Process } from '@/domain';
import { getT } from '@/i18n';
import type { FormTemplate } from '@/import/tableau';

import { supabase } from './client';
import { linkErrorMessage } from './links';
import { sharingErrorMessage, SharingError } from './sharing';

/** 'form' : un formulaire seul ; 'workflow' : un workflow seul ; 'form_workflow' : les deux. */
export type ViewKind = 'form' | 'workflow' | 'form_workflow';

/** Ce que garde le lien, au format de l'app. */
export type ViewContent = { form?: FormTemplate; workflow?: LinkedWorkflow };

export type ViewLink = {
  id: string;
  kind: ViewKind;
  title: string;
  note: string | null;
  token: string;
  createdAt: string;
  expiresAt: string;
};

/** Ce que montre la page du lien. */
export type ViewLinkView = {
  kind: ViewKind;
  title: string;
  note: string | null;
  form: FormTemplate | null;
  workflow: LinkedWorkflow | null;
  ownerName: string;
  expiresAt: string;
};

/** Au plus 5 Mo, comme le serveur. */
const MAX_BYTES = 5_000_000;

/** Adresse de la page du lien, dans la version web de l'app. */
export const viewLinkUrl = (token: string) => `${SITE_URL}app/voir/${token}`;

/** Le process tel qu'on le montre : sans ce qui ne regarde que son propriétaire (projet, date de correction). */
function processCopy(process: Process): Process {
  const { projectId: _projectId, editedAt: _editedAt, ...rest } = process;
  return { ...rest, id: 'lien' };
}

function workflowCopy(workflow: LinkedWorkflow): LinkedWorkflow {
  return workflow.kind === 'process' ? { ...workflow, process: processCopy(workflow.process) } : workflow;
}

/**
 * La sorte du lien et sa copie, à partir de ce qu'on montre : un formulaire
 * (et son workflow s'il en a un), ou un process seul. `null` s'il n'y a rien.
 * Les avertissements de lecture du formulaire ne sont pas gardés.
 */
export function viewContentOf(form: FormTemplate | null, workflow: LinkedWorkflow | null): { kind: ViewKind; content: ViewContent } | null {
  const formCopy = form ? { ...form, warnings: [] } : null;
  if (formCopy && workflow) return { kind: 'form_workflow', content: { form: formCopy, workflow: workflowCopy(workflow) } };
  if (formCopy) return { kind: 'form', content: { form: formCopy } };
  if (workflow) return { kind: 'workflow', content: { workflow: workflowCopy(workflow) } };
  return null;
}

/** Un process seul, vu comme le workflow d'un lien. */
export const processWorkflow = (process: Process): LinkedWorkflow => ({
  kind: 'process',
  source: process.name,
  process,
});

const isForm = (value: unknown): value is FormTemplate => Array.isArray((value as FormTemplate | null)?.questions);

function isWorkflow(value: unknown): value is LinkedWorkflow {
  const workflow = value as LinkedWorkflow | null;
  if (workflow?.kind === 'situations') return Array.isArray(workflow.situations);
  if (workflow?.kind === 'process') return Array.isArray(workflow.process?.steps) && Array.isArray(workflow.process?.links);
  return false;
}

/**
 * Relit la copie d'un lien. Une copie qui ne correspond pas à sa sorte (lien
 * abîmé, ou fait par une autre version de l'app) donne `null`.
 */
export function readViewContent(kind: string, content: unknown): Pick<ViewLinkView, 'kind' | 'form' | 'workflow'> | null {
  const data = (content ?? {}) as { form?: unknown; workflow?: unknown };
  const form = isForm(data.form) ? { ...data.form, warnings: data.form.warnings ?? [] } : null;
  const workflow = isWorkflow(data.workflow) ? data.workflow : null;
  if (kind === 'form' && form) return { kind, form, workflow: null };
  if (kind === 'workflow' && workflow) return { kind, form: null, workflow };
  if (kind === 'form_workflow' && form && workflow) return { kind, form, workflow };
  return null;
}

export function viewLinkErrorMessage(error: { code?: string; message?: string }): SharingError {
  switch (error.code) {
    case 'SF429':
      return new SharingError(getT().errors.viewLinkTooMany);
    case 'PGRST202':
    case '42883':
    case '42P01':
    case 'PGRST205':
      return new SharingError(getT().errors.noViewLinkTable);
    default:
      return sharingErrorMessage(error);
  }
}

type Row = {
  id: string;
  kind: ViewKind;
  title: string;
  note: string | null;
  token: string;
  created_at: string;
  expires_at: string;
};
const COLUMNS = 'id, kind, title, note, token, created_at, expires_at';
const fromRow = (row: Row): ViewLink => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  note: row.note,
  token: row.token,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

/** Crée un lien (compte connecté). Le jeton et la date de fin (30 jours) viennent du serveur. */
export async function createViewLink(input: {
  title: string;
  note?: string | null;
  form: FormTemplate | null;
  workflow: LinkedWorkflow | null;
}): Promise<ViewLink> {
  const built = viewContentOf(input.form, input.workflow);
  if (!built) throw new SharingError(getT().errors.viewLinkBroken);
  if (JSON.stringify(built.content).length > MAX_BYTES) throw new SharingError(getT().errors.viewLinkTooBig);
  const note = input.note?.trim() ? input.note.trim().slice(0, 1000) : null;
  const { data, error } = await supabase
    .from('view_links')
    .insert({ kind: built.kind, title: input.title.trim().slice(0, 200), content: built.content, note })
    .select(COLUMNS)
    .single();
  if (error) throw viewLinkErrorMessage(error);
  return fromRow(data as Row);
}

/** Ses liens de consultation, du plus récent au plus ancien (sans leur copie). */
export async function listViewLinks(): Promise<ViewLink[]> {
  const { data, error } = await supabase.from('view_links').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw viewLinkErrorMessage(error);
  return ((data ?? []) as Row[]).map(fromRow);
}

/** Prolonge un lien de 30 jours à partir d'aujourd'hui. Renvoie la nouvelle date de fin. */
export async function extendViewLink(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('view_link_extend', { p_link: id });
  if (error) throw viewLinkErrorMessage(error);
  return data as string;
}

/** Retire un lien : il ne s'ouvre plus. */
export async function removeViewLink(id: string): Promise<void> {
  const { error } = await supabase.from('view_links').delete().eq('id', id);
  if (error) throw viewLinkErrorMessage(error);
}

type OpenRow = {
  kind: string;
  title: string;
  content: unknown;
  note: string | null;
  expires_at: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_username: string | null;
};

/** Ouvre un lien par son jeton, sans compte. */
export async function openViewLink(token: string): Promise<ViewLinkView> {
  const { data, error } = await supabase.rpc('view_link_open', { p_token: token });
  if (error) throw linkErrorMessage(error);
  const row = ((data ?? []) as OpenRow[])[0];
  if (!row) throw linkErrorMessage({ code: 'P0002' });
  const read = readViewContent(row.kind, row.content);
  if (!read) throw new SharingError(getT().errors.viewLinkBroken);
  const name = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(' ').trim();
  return {
    ...read,
    title: row.title,
    note: row.note,
    expiresAt: row.expires_at,
    ownerName: name || (row.owner_username ? `@${row.owner_username}` : getT().errors.processOwner),
  };
}
