import {
  DEFAULT_IMPORT_POLICY,
  type ImportPolicy,
  loadImportPolicy,
  resetImportPolicy,
  saveImportPolicy
} from '../import-policy';
import type { Env } from '../ghl';

function getAuthHeader(request: Request): string | null {
  return request.headers.get('x-webhook-secret') || request.headers.get('authorization');
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.WEBHOOK_SECRET) return false;
  const header = getAuthHeader(request);
  if (!header) return false;
  return header === env.WEBHOOK_SECRET || header === `Bearer ${env.WEBHOOK_SECRET}`;
}

export async function adminImportPolicyRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (request.method === 'GET') {
      return Response.json({
        ok: true,
        policy: await loadImportPolicy(env),
        defaults: DEFAULT_IMPORT_POLICY
      });
    }

    if (request.method === 'PUT') {
      const payload = await request.json() as Partial<ImportPolicy>;
      return Response.json({
        ok: true,
        policy: await saveImportPolicy(env, payload)
      });
    }

    if (request.method === 'POST') {
      return Response.json({
        ok: true,
        policy: await resetImportPolicy(env)
      });
    }

    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown admin import policy error'
    }, { status: 500 });
  }
}
