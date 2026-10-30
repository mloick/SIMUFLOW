import { describe, expect, it, jest } from '@jest/globals';

import { createSessionStore, type AuthLike, type SessionLike } from '../session-store';

function fakeAuth(saved: SessionLike | null) {
  let onChange: (event: string, session: SessionLike | null) => void = () => {};
  const auth: AuthLike = {
    getSession: jest.fn(async () => ({ data: { session: saved } })),
    onAuthStateChange: jest.fn((callback: typeof onChange) => {
      onChange = callback;
    }),
  };
  return { auth, emit: (session: SessionLike | null) => onChange('EVENT', session) };
}

const camille = { user: { id: 'a', email: 'camille@exemple.fr' } };

describe('createSessionStore', () => {
  it('ne contacte Supabase qu’au premier abonné', () => {
    const { auth } = fakeAuth(null);
    const store = createSessionStore(auth);
    expect(auth.getSession).not.toHaveBeenCalled();
    store.subscribe(() => {});
    store.subscribe(() => {});
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('passe de « inconnu » à la session enregistrée', async () => {
    const { auth } = fakeAuth(camille);
    const store = createSessionStore(auth);
    const listener = jest.fn();
    store.subscribe(listener);
    expect(store.get()).toBeUndefined();
    await Promise.resolve();
    expect(store.get()).toBe(camille);
    expect(listener).toHaveBeenCalled();
  });

  it('suit la connexion et la déconnexion', async () => {
    const { auth, emit } = fakeAuth(null);
    const store = createSessionStore(auth);
    store.subscribe(() => {});
    await Promise.resolve();
    expect(store.get()).toBeNull();
    emit(camille);
    expect(store.get()).toBe(camille);
    emit(null);
    expect(store.get()).toBeNull();
  });

  it('ne revient pas en arrière si un changement arrive avant la lecture', async () => {
    const { auth, emit } = fakeAuth(null);
    const store = createSessionStore(auth);
    store.subscribe(() => {});
    emit(camille);
    await Promise.resolve();
    expect(store.get()).toBe(camille);
  });
});
