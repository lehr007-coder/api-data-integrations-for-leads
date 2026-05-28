import type { Env } from '../ghl';

export function reolStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'reol',
    configured: Boolean(env.REOL_API_KEY),
    note: 'REOL_API_KEY is stored. Add provider-specific endpoint documentation before enabling live fetches.'
  });
}
