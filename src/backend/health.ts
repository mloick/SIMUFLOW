/**
 * Le serveur répond-il ? Interroge le service d'authentification de Supabase
 * (`/auth/v1/health`), qui répond sans connexion, avec la clé publique.
 */

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export type ServerStatus = 'ok' | 'unreachable' | 'error';

/** Délai au-delà duquel le serveur est jugé injoignable. */
const TIMEOUT_MS = 8000;

export async function checkServer(fetchImpl: typeof fetch = fetch): Promise<ServerStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller.signal,
    });
    return response.ok ? 'ok' : 'error';
  } catch {
    // Pas de réseau, serveur en pause, ou délai dépassé.
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}
