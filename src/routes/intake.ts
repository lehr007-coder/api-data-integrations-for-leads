import { normalizeLead } from '../normalize';
import { scoreLead } from '../score';
import { evaluateCompliance, applyComplianceDecision } from '../compliance';
import { checkAndStoreDedupe } from '../dedupe';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import { evaluateDistributionReadiness, applyDistributionDecision } from '../distribution-feeder';
import { evaluateImportPolicy, storeImportHold } from '../import-policy';
import type { IntakeLeadPayload } from '../types';

function getAuthHeader(request: Request): string | null {
  return request.headers.get('x-webhook-secret') || request.headers.get('authorization');
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.WEBHOOK_SECRET) return false;
  const header = getAuthHeader(request);
  if (!header) return false;
  return header === env.WEBHOOK_SECRET || header === `Bearer ${env.WEBHOOK_SECRET}`;
}

export async function intakeRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.GHL_API_TOKEN) {
      return Response.json({
        ok: false,
        error: 'GHL_API_TOKEN is not configured.'
      }, { status: 503 });
    }

    const payload = await request.json() as IntakeLeadPayload;
    const cloudflareRecordRef = crypto.randomUUID();

    const normalized = normalizeLead(payload, cloudflareRecordRef);
    const scored = scoreLead(normalized);
    const compliance = evaluateCompliance(scored);
    const compliantLead = applyComplianceDecision(scored, compliance);

    const dedupe = await checkAndStoreDedupe(env.DEDUPE_KV, compliantLead);
    if (dedupe.isDuplicate) {
      return Response.json({
        ok: true,
        duplicate: true,
        dedupeKey: dedupe.dedupeKey,
        message: 'Duplicate lead blocked before GHL creation.'
      });
    }

    await env.RAW_PAYLOADS.put(
      `${cloudflareRecordRef}.json`,
      JSON.stringify({ receivedAt: new Date().toISOString(), payload }, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );

    const initialFeeder = evaluateDistributionReadiness(compliantLead);
    const routedLead = applyDistributionDecision(compliantLead, initialFeeder);
    const importDecision = await evaluateImportPolicy(env, routedLead);

    if (!importDecision.allowGhlSync) {
      await storeImportHold(env, cloudflareRecordRef, routedLead, importDecision);
      return Response.json({
        ok: true,
        duplicate: false,
        cloudflareRecordRef,
        dedupeKey: dedupe.dedupeKey,
        route: 'admin_hold',
        importPolicy: importDecision,
        compliance,
        feeder: initialFeeder,
        lead: routedLead
      });
    }

    const ghl = await createOrUpdateGhlContact(env, routedLead);

    return Response.json({
      ok: true,
      duplicate: false,
      cloudflareRecordRef,
      dedupeKey: dedupe.dedupeKey,
      ghl,
      importPolicy: importDecision,
      compliance,
      feeder: initialFeeder,
      lead: routedLead
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown intake error'
    }, { status: 500 });
  }
}
