import {
  DEFAULT_IMPORT_POLICY,
  type ImportPolicy,
  loadImportPolicy,
  resetImportPolicy,
  saveImportPolicy
} from '../import-policy';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import type { NormalizedLead } from '../types';

interface AdminReleaseRequest {
  cloudflareRecordRef?: string;
  tags?: string[];
}

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

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function adminReleaseRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    if (!env.GHL_API_TOKEN) {
      return Response.json({ ok: false, error: 'GHL_API_TOKEN is not configured.' }, { status: 503 });
    }

    const input = await request.json() as AdminReleaseRequest;
    const cloudflareRecordRef = clean(input.cloudflareRecordRef);
    if (!cloudflareRecordRef) {
      return Response.json({ ok: false, error: 'cloudflareRecordRef is required.' }, { status: 400 });
    }

    const holdObject = await env.RAW_PAYLOADS.get(`${cloudflareRecordRef}.admin-hold.json`);
    if (!holdObject) {
      return Response.json({ ok: false, error: `No admin hold found for ${cloudflareRecordRef}.` }, { status: 404 });
    }

    const hold: any = await holdObject.json();
    const lead: NormalizedLead = {
      ...hold.lead,
      tags: Array.from(new Set([
        ...(Array.isArray(hold.lead?.tags) ? hold.lead.tags.map(String) : []),
        ...(Array.isArray(input.tags) ? input.tags.map(String) : []),
        'admin-release-approved'
      ]))
    };

    const ghl = await createOrUpdateGhlContact(env, lead);
    await env.RAW_PAYLOADS.put(
      `${cloudflareRecordRef}.admin-release.json`,
      JSON.stringify({ releasedAt: new Date().toISOString(), input, ghl, lead }, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return Response.json({
      ok: true,
      cloudflareRecordRef,
      ghl,
      lead
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown admin release error'
    }, { status: 500 });
  }
}
