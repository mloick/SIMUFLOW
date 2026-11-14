/**
 * Membres et avis d'un process partagé, lus sur le serveur pour son
 * propriétaire (fiche du process et écran « Suivi de la validation »).
 */

import { useCallback, useEffect, useState } from 'react';

import { listLinkActivity, type ActorLink } from '@/backend/links';
import { listMembers, listProcessReviews, memberName } from '@/backend/sharing';
import type { MemberReview, ValidationMember } from '@/domain';

export type ValidationData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; members: ValidationMember[]; reviews: MemberReview[] };

/** Lit les membres et leurs avis ; `reload` relit (après une erreur, ou pour voir les nouveaux avis). */
export function useValidationData(cloudId: string | undefined): ValidationData & { reload: () => void } {
  const [data, setData] = useState<ValidationData>({ status: 'loading' });

  const fetchData = useCallback(() => {
    if (!cloudId) return Promise.resolve();
    return Promise.all([
      listMembers(cloudId),
      listProcessReviews(cloudId),
      // Les liens d'acteur sont un plus : sans leur script SQL, le suivi marche quand même.
      listLinkActivity([cloudId]).catch(() => ({ links: [], reviews: [] })),
    ]).then(
      ([members, reviews, links]) =>
        setData({
          status: 'ready',
          members: [
            ...members.map((member) => ({ id: member.id, name: memberName(member), actor: member.actor })),
            ...links.links.map((link) => linkMember(link, links.reviews)),
          ],
          reviews: [...reviews, ...links.reviews],
        }),
      (cause: unknown) =>
        setData({
          status: 'error',
          message: cause instanceof Error ? cause.message : 'Le suivi n’a pas pu être lu.',
        }),
    );
  }, [cloudId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reload = useCallback(() => {
    setData({ status: 'loading' });
    fetchData();
  }, [fetchData]);

  return { ...data, reload };
}

/** Un lien d'acteur compte comme un membre : il porte le nom confirmé sur la page du lien. */
export function linkMember(link: ActorLink, reviews: { memberId: string; reviewerName: string }[]): ValidationMember {
  const id = `lien:${link.id}`;
  const name = reviews.find((review) => review.memberId === id)?.reviewerName;
  return { id, name: name ? `${name} (lien)` : `Lien « ${link.actor} », pas encore ouvert`, actor: link.actor };
}
