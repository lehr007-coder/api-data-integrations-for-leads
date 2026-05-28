import type { Env } from '../ghl';

export function dataGovStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'data.gov',
    configured: Boolean(env.DATA_GOV_API_KEY),
    note: 'DATA_GOV_API_KEY is stored for agency APIs that use api.data.gov gateway authentication.'
  });
}
