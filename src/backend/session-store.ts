/**
 * La session de l'utilisateur connecté, tenue à jour par Supabase Auth.
 *
 * Écrit sans dépendre du vrai client pour pouvoir le tester : `auth` est
 * n'importe quel objet qui sait donner la session et prévenir quand elle change.
 */

export type SessionUser = { id: string; email?: string };
export type SessionLike = { user: SessionUser };

/** `undefined` : on ne sait pas encore (lecture du téléphone en cours). */
export type SessionState = SessionLike | null | undefined;

export type AuthLike = {
  getSession(): Promise<{ data: { session: SessionLike | null } }>;
  onAuthStateChange(callback: (event: string, session: SessionLike | null) => void): unknown;
};

export function createSessionStore(auth: AuthLike) {
  let current: SessionState;
  let started = false;
  const listeners = new Set<() => void>();

  const set = (session: SessionLike | null) => {
    current = session;
    listeners.forEach((listener) => listener());
  };

  // Ne démarre qu'au premier abonné : rien ne part au réseau avant.
  const start = () => {
    if (started) return;
    started = true;
    auth.onAuthStateChange((_event, session) => set(session));
    auth.getSession().then(
      ({ data }) => {
        if (current === undefined) set(data.session);
      },
      () => set(null),
    );
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    get: (): SessionState => current,
  };
}
