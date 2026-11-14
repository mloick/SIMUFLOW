/**
 * Membres et avis d'un process partagé, lus sur le serveur pour son
 * propriétaire (fiche du process et écran « Suivi de la validation »).
 */

import { useCallback, useEffect, useState } from 'react';

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
    return Promise.all([listMembers(cloudId), listProcessReviews(cloudId)]).then(
      ([members, reviews]) =>
        setData({
          status: 'ready',
          members: members.map((member) => ({ id: member.id, name: memberName(member), actor: member.actor })),
          reviews,
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
