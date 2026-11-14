/**
 * Le profil du compte connecté, lu une fois par compte puis gardé en mémoire
 * pour le Profil et l'écran « Mon profil ». Rien sans connexion.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { useSession } from '@/backend/auth';
import { getMyProfile, saveMyProfile } from '@/backend/profiles';
import type { Profile } from '@/domain';

export type ProfileState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile | null }
  | { status: 'error'; message: string };

let state: ProfileState = { status: 'none' };
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function set(next: ProfileState) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function load(userId: string) {
  loadedFor = userId;
  set({ status: 'loading' });
  try {
    const profile = await getMyProfile();
    if (loadedFor === userId) set({ status: 'ready', profile });
  } catch (cause) {
    if (loadedFor === userId)
      set({ status: 'error', message: cause instanceof Error ? cause.message : 'Le profil n’a pas pu être lu.' });
  }
}

/** Le profil du compte connecté ; le relit quand le compte change. */
export function useMyProfile(): ProfileState & { reload: () => void } {
  const session = useSession();
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      loadedFor = null;
      if (state.status !== 'none') set({ status: 'none' });
    } else if (loadedFor !== userId) {
      load(userId);
    }
  }, [userId]);
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
  return { ...current, reload: () => userId && load(userId) };
}

/** Enregistre le profil sur le serveur, puis le garde en mémoire. Lève `ProfileError`. */
export async function updateMyProfile(profile: Profile): Promise<Profile> {
  const saved = await saveMyProfile(profile);
  set({ status: 'ready', profile: saved });
  return saved;
}
