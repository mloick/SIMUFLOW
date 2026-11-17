/**
 * Liens d'acteur : relire sa partie d'un process sans compte (voir
 * supabase/migrations/20261119000000_liens_acteurs.sql). Le propriétaire crée
 * un lien par acteur ; la page du lien passe par trois fonctions qui demandent
 * le jeton, et rien d'autre n'est lisible sans compte.
 */

import { SITE_URL } from '@/constants/links';
import type { MemberReview, Process, StepReview } from '@/domain';

import { supabase } from './client';
import { fromRow as processFromRow, type ProcessRow } from './process-row';
import { sharingErrorMessage, SharingError } from './sharing';
import { getT } from '@/i18n';

export type ActorLink = {
  id: string;
  processId: string;
  actor: string;
  token: string;
  /** Après cette date, la page du lien ne s'ouvre plus (script 20261125000000_liens_expiration.sql). */
  expiresAt?: string;
};

/** Adresse de la page du lien, dans la version web de l'app. */
export const linkUrl = (token: string) => `${SITE_URL}app/lien/${token}`;

type LinkRow = { id: string; process_id: string; actor: string; token: string; expires_at?: string | null };
const fromLinkRow = (row: LinkRow): ActorLink => ({
  id: row.id,
  processId: row.process_id,
  actor: row.actor,
  token: row.token,
  ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
});

/** Le lien a-t-il expiré ? Sans date (script pas encore collé), il n'expire pas. */
export const isLinkExpired = (link: Pick<ActorLink, 'expiresAt'>, now = new Date()) =>
  !!link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime();

/** Le lien expire-t-il dans moins d'une semaine, ou a-t-il expiré ? « Prolonger » apparaît alors. */
export const linkNeedsExtension = (link: Pick<ActorLink, 'expiresAt'>, now = new Date()) =>
  !!link.expiresAt && new Date(link.expiresAt).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

/** Les liens d'un process (pour son propriétaire). */
export async function listActorLinks(cloudId: string): Promise<ActorLink[]> {
  const { data, error } = await supabase
    .from('actor_links')
    .select('id, process_id, actor, token, expires_at')
    .eq('process_id', cloudId)
    .order('created_at');
  if (error) throw sharingErrorMessage(error);
  return ((data ?? []) as LinkRow[]).map(fromLinkRow);
}

export async function createActorLink(cloudId: string, actor: string): Promise<ActorLink> {
  const { data, error } = await supabase
    .from('actor_links')
    .insert({ process_id: cloudId, actor })
    .select('id, process_id, actor, token, expires_at')
    .single();
  if (error) throw sharingErrorMessage(error);
  return fromLinkRow(data as LinkRow);
}

/** Prolonge un lien de 30 jours à partir d'aujourd'hui. Renvoie la nouvelle date de fin. */
export async function extendActorLink(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('link_extend', { p_link: id });
  if (error) throw sharingErrorMessage(error);
  return data as string;
}

/** Retire un lien : il ne s'ouvre plus, et ses avis partent avec lui. */
export async function removeActorLink(id: string): Promise<void> {
  const { error } = await supabase.from('actor_links').delete().eq('id', id);
  if (error) throw sharingErrorMessage(error);
}

/** Avis donnés par les liens de plusieurs process, pour leur propriétaire. */
export async function listLinkActivity(cloudIds: string[]): Promise<{
  links: ActorLink[];
  reviews: (MemberReview & { reviewerName: string; updatedAt: string })[];
}> {
  if (cloudIds.length === 0) return { links: [], reviews: [] };
  const links = await supabase.from('actor_links').select('id, process_id, actor, token').in('process_id', cloudIds);
  if (links.error) throw sharingErrorMessage(links.error);
  const list = ((links.data ?? []) as LinkRow[]).map(fromLinkRow);
  if (list.length === 0) return { links: [], reviews: [] };
  const reviews = await supabase
    .from('link_reviews')
    .select('link_id, step_id, status, comment, reviewer_name, updated_at')
    .in(
      'link_id',
      list.map((link) => link.id),
    );
  if (reviews.error) throw sharingErrorMessage(reviews.error);
  type Row = {
    link_id: string;
    step_id: string;
    status: StepReview['status'];
    comment: string | null;
    reviewer_name: string;
    updated_at: string;
  };
  return {
    links: list,
    reviews: ((reviews.data ?? []) as Row[]).map((row) => ({
      memberId: linkMemberId(row.link_id),
      stepId: row.step_id,
      status: row.status,
      comment: row.comment,
      reviewerName: row.reviewer_name,
      updatedAt: row.updated_at,
    })),
  };
}

/**
 * Liens d'un process et leurs avis, SANS le jeton, pour le propriétaire et
 * l'équipe du projet (tableau de bord). Fonction `link_activity_of` du script
 * 20261123000000_liens_equipe.sql.
 */
export async function listTeamLinkActivity(cloudId: string): Promise<{
  links: Pick<ActorLink, 'id' | 'actor'>[];
  reviews: (MemberReview & { reviewerName: string; updatedAt: string })[];
}> {
  const { data, error } = await supabase.rpc('link_activity_of', { p_process: cloudId });
  if (error) throw sharingErrorMessage(error);
  type Row = {
    link_id: string;
    actor: string;
    step_id: string | null;
    status: StepReview['status'] | null;
    comment: string | null;
    reviewer_name: string | null;
    updated_at: string | null;
  };
  const rows = (data ?? []) as Row[];
  const links = new Map(rows.map((row) => [row.link_id, { id: row.link_id, actor: row.actor }]));
  return {
    links: [...links.values()],
    reviews: rows
      .filter((row) => row.step_id && row.status)
      .map((row) => ({
        memberId: linkMemberId(row.link_id),
        stepId: row.step_id!,
        status: row.status!,
        comment: row.comment,
        reviewerName: row.reviewer_name ?? '',
        updatedAt: row.updated_at ?? '',
      })),
  };
}

/** Un lien compte comme un membre dans le suivi de la validation. */
export const linkMemberId = (linkId: string) => `lien:${linkId}`;

/** Ce que montre la page d'un lien. */
export type LinkView = {
  process: Process;
  actor: string;
  ownerName: string;
  reviews: StepReview[];
  /** Le nom déjà donné sur ce lien, s'il y a des avis. */
  reviewerName: string | null;
};

type OpenRow = {
  process_name: string;
  content: ProcessRow['content'];
  actor: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_username: string | null;
  reviews: { step_id: string; status: StepReview['status']; comment: string | null; reviewer_name: string }[];
};

export async function openLink(token: string): Promise<LinkView> {
  const { data, error } = await supabase.rpc('link_open', { p_token: token });
  if (error) throw linkErrorMessage(error);
  const row = ((data ?? []) as OpenRow[])[0];
  if (!row) throw linkErrorMessage({ code: 'P0002' });
  const process = processFromRow({
    id: `lien-${token.slice(0, 12)}`,
    owner_id: '',
    name: row.process_name,
    source: null,
    content: row.content,
    created_at: '',
    updated_at: '',
  });
  const name = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(' ').trim();
  return {
    process,
    actor: row.actor,
    ownerName: name || (row.owner_username ? `@${row.owner_username}` : getT().errors.processOwner),
    reviews: row.reviews.map((review) => ({ stepId: review.step_id, status: review.status, comment: review.comment })),
    reviewerName: row.reviews[0]?.reviewer_name ?? null,
  };
}

export async function reviewByLink(token: string, name: string, review: StepReview): Promise<void> {
  const { error } = await supabase.rpc('link_review', {
    p_token: token,
    p_name: name,
    p_step: review.stepId,
    p_status: review.status,
    p_comment: review.comment,
  });
  if (error) throw linkErrorMessage(error);
}

export async function unreviewByLink(token: string, stepId: string): Promise<void> {
  const { error } = await supabase.rpc('link_unreview', { p_token: token, p_step: stepId });
  if (error) throw linkErrorMessage(error);
}

/** Messages de la page du lien. */
export function linkErrorMessage(error: { code?: string; message?: string }): SharingError {
  switch (error.code) {
    case 'P0002':
      return new SharingError(getT().errors.linkGone);
    case 'SF410':
      return new SharingError(getT().errors.linkExpired);
    case '22023':
      return new SharingError(getT().errors.stepGone);
    case '42501':
      return new SharingError(getT().errors.notYourPart);
    default:
      return sharingErrorMessage(error);
  }
}
