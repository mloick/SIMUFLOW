import { describe, expect, it } from '@jest/globals';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { checkServer } from '../health';

const respond = (status: number) => (async () => ({ ok: status < 400, status })) as unknown as typeof fetch;

describe('état du serveur', () => {
  it('interroge le service d’authentification avec la clé publique', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const spy = (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    expect(await checkServer(spy)).toBe('ok');
    expect(calls[0][0]).toBe(`${SUPABASE_URL}/auth/v1/health`);
    expect(calls[0][1]?.headers).toEqual({ apikey: SUPABASE_PUBLISHABLE_KEY });
  });

  it('signale une erreur du serveur', async () => {
    expect(await checkServer(respond(503))).toBe('error');
  });

  it('signale un serveur injoignable', async () => {
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await checkServer(offline)).toBe('unreachable');
  });

  it('n’envoie jamais la clé secrète', () => {
    expect(SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')).toBe(true);
  });
});
