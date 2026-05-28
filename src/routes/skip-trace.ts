import { normalizeLead } from '../normalize';
import { scoreLead } from '../score';
import { evaluateCompliance, applyComplianceDecision } from '../compliance';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import { evaluateDistributionReadiness, applyDistributionDecision } from '../distribution-feeder';
import type { IntakeLeadPayload } from '../types';

interface SkipTraceCompleteRequest {
  cloudflareRecordRef?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  owner_name?: string;
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

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readPendingRecord(env: Env, cloudflareRecordRef: string): Promise<any> {
  const object = await env.RAW_PAYLOADS.get(`${cloudflareRecordRef}.attom.json`);
  if (!object) {
    throw new Error(`Pending ATTOM record not found for ${cloudflareRecordRef}.`);
  }

  return object.json();
}

function mergePayload(record: any, input: SkipTraceCompleteRequest): IntakeLeadPayload {
  const original = record?.payload || {};
  const appendedTags = Array.isArray(input.tags) ? input.tags.map(String) : [];
  const originalTags = Array.isArray(original.tags) ? original.tags.map(String) : [];

  return {
    ...original,
    email: clean(input.email) || original.email,
    phone: clean(input.phone) || original.phone,
    first_name: clean(input.first_name) || original.first_name,
    last_name: clean(input.last_name) || original.last_name,
    owner_name: clean(input.owner_name) || original.owner_name,
    tags: Array.from(new Set([
      ...originalTags,
      ...appendedTags,
      'skip-trace-complete',
      'api-feed-contact-appended'
    ]))
  };
}

export async function skipTraceCompleteRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.GHL_API_TOKEN) {
      return Response.json({ ok: false, error: 'GHL_API_TOKEN is not configured.' }, { status: 503 });
    }

    const input = await request.json() as SkipTraceCompleteRequest;
    const cloudflareRecordRef = clean(input.cloudflareRecordRef);

    if (!cloudflareRecordRef) {
      return Response.json({ ok: false, error: 'cloudflareRecordRef is required.' }, { status: 400 });
    }

    if (!clean(input.email) && !clean(input.phone)) {
      return Response.json({ ok: false, error: 'email or phone is required to complete skip trace.' }, { status: 400 });
    }

    const pendingRecord = await readPendingRecord(env, cloudflareRecordRef);
    const payload = mergePayload(pendingRecord, input);
    const normalized = normalizeLead(payload, cloudflareRecordRef);
    const scored = scoreLead(normalized);
    const compliance = evaluateCompliance(scored);
    const compliantLead = applyComplianceDecision(scored, compliance);
    const feeder = evaluateDistributionReadiness(compliantLead);
    const routedLead = applyDistributionDecision(compliantLead, feeder);
    const ghl = await createOrUpdateGhlContact(env, routedLead);

    await env.RAW_PAYLOADS.put(
      `${cloudflareRecordRef}.skip-trace-complete.json`,
      JSON.stringify({
        completedAt: new Date().toISOString(),
        input: {
          cloudflareRecordRef,
          hasEmail: Boolean(input.email),
          hasPhone: Boolean(input.phone),
          tags: input.tags || []
        },
        payload,
        compliance,
        feeder,
        ghl
      }, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return Response.json({
      ok: true,
      cloudflareRecordRef,
      ghl,
      compliance,
      feeder,
      lead: routedLead
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown skip trace completion error'
    }, { status: 500 });
  }
}
