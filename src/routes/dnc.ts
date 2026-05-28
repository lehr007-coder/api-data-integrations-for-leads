import { normalizeLead } from '../normalize';
import { scoreLead } from '../score';
import { evaluateCompliance, applyComplianceDecision } from '../compliance';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import type { IntakeLeadPayload, NormalizedLead } from '../types';

type DncStatus = 'clear' | 'blocked' | 'direct_mail_only';

interface DncCompleteRequest {
  cloudflareRecordRef?: string;
  dnc_status?: DncStatus;
  provider?: string;
  result_id?: string;
  notes?: string;
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

async function readProcessedPayload(env: Env, cloudflareRecordRef: string): Promise<IntakeLeadPayload> {
  const skipTraceObject = await env.RAW_PAYLOADS.get(`${cloudflareRecordRef}.skip-trace-complete.json`);
  if (skipTraceObject) {
    const record: any = await skipTraceObject.json();
    return record?.payload || {};
  }

  const attomObject = await env.RAW_PAYLOADS.get(`${cloudflareRecordRef}.attom.json`);
  if (attomObject) {
    const record: any = await attomObject.json();
    return record?.payload || {};
  }

  const intakeObject = await env.RAW_PAYLOADS.get(`${cloudflareRecordRef}.json`);
  if (intakeObject) {
    const record: any = await intakeObject.json();
    return record?.payload || {};
  }

  throw new Error(`Record not found for ${cloudflareRecordRef}.`);
}

function withoutRoutingHoldTags(tags: string[]): string[] {
  const remove = new Set([
    'needs-dnc-check',
    'api-feed-dnc-check-first',
    'api-feed-skip-trace-first',
    'needs-skip-trace'
  ]);
  return tags.filter((tag) => !remove.has(tag));
}

function applyDncStatus(lead: NormalizedLead, input: DncCompleteRequest): NormalizedLead {
  const status = input.dnc_status || 'clear';
  const inputTags = Array.isArray(input.tags) ? input.tags.map(String) : [];
  const tags = new Set([...withoutRoutingHoldTags(lead.tags), ...inputTags]);

  tags.add(`dnc-${status.replaceAll('_', '-')}`);
  tags.add('dnc-check-complete');

  if (input.provider) tags.add(`dnc-provider-${input.provider}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));

  if (status === 'blocked') {
    tags.add('api-feed-do-not-distribute');
    return {
      ...lead,
      complianceStatus: 'blocked',
      tags: Array.from(tags)
    };
  }

  if (status === 'direct_mail_only') {
    tags.add('api-feed-direct-mail-only');
    return {
      ...lead,
      complianceStatus: 'approved',
      tags: Array.from(tags)
    };
  }

  tags.add('api-feed-distribution-ready');
  return {
    ...lead,
    complianceStatus: 'approved',
    tags: Array.from(tags)
  };
}

function routeFor(status: DncStatus): 'ready' | 'blocked' | 'direct_mail_only' {
  if (status === 'blocked') return 'blocked';
  if (status === 'direct_mail_only') return 'direct_mail_only';
  return 'ready';
}

export async function dncCompleteRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.GHL_API_TOKEN) {
      return Response.json({ ok: false, error: 'GHL_API_TOKEN is not configured.' }, { status: 503 });
    }

    const input = await request.json() as DncCompleteRequest;
    const cloudflareRecordRef = clean(input.cloudflareRecordRef);
    const dncStatus = input.dnc_status || 'clear';

    if (!cloudflareRecordRef) {
      return Response.json({ ok: false, error: 'cloudflareRecordRef is required.' }, { status: 400 });
    }

    if (!['clear', 'blocked', 'direct_mail_only'].includes(dncStatus)) {
      return Response.json({ ok: false, error: 'dnc_status must be clear, blocked, or direct_mail_only.' }, { status: 400 });
    }

    const payload = await readProcessedPayload(env, cloudflareRecordRef);
    const normalized = normalizeLead(payload, cloudflareRecordRef);
    const scored = scoreLead(normalized);
    const compliance = evaluateCompliance(scored);
    const compliantLead = applyComplianceDecision(scored, compliance);
    const routedLead = applyDncStatus(compliantLead, input);
    const ghl = await createOrUpdateGhlContact(env, routedLead);
    const route = routeFor(dncStatus);

    await env.RAW_PAYLOADS.put(
      `${cloudflareRecordRef}.dnc-complete.json`,
      JSON.stringify({
        completedAt: new Date().toISOString(),
        input: {
          cloudflareRecordRef,
          dnc_status: dncStatus,
          provider: input.provider,
          result_id: input.result_id,
          notes: input.notes,
          tags: input.tags || []
        },
        route,
        payload,
        ghl
      }, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return Response.json({
      ok: true,
      cloudflareRecordRef,
      route,
      ghl,
      lead: routedLead
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown DNC completion error'
    }, { status: 500 });
  }
}
