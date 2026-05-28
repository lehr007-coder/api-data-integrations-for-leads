import { normalizeLead } from '../normalize';
import { scoreLead } from '../score';
import { evaluateCompliance, applyComplianceDecision } from '../compliance';
import { checkAndStoreDedupe } from '../dedupe';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import { evaluateDistributionReadiness, applyDistributionDecision } from '../distribution-feeder';
import type { IntakeLeadPayload } from '../types';

interface AttomPropertyRequest {
  address?: string;
  address1?: string;
  address2?: string;
  lead_type?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  county?: string;
  case_number?: string;
  filing_date?: string;
  estimated_equity?: number;
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

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function firstProperty(body: any): any | undefined {
  return Array.isArray(body?.property) ? body.property[0] : undefined;
}

function ownerName(property: any, fallback?: string): string | undefined {
  return clean(property?.owner?.owner1?.fullName)
    || clean(property?.owner?.owner1?.name)
    || clean(property?.owner?.owner1FullName)
    || fallback;
}

function oneLineAddress(property: any, fallback?: string): string | undefined {
  return clean(property?.address?.oneLine)
    || [property?.address?.line1, property?.address?.locality, property?.address?.countrySubd, property?.address?.postal1]
      .map(clean)
      .filter(Boolean)
      .join(' ')
    || fallback;
}

function mapAttomToLead(request: AttomPropertyRequest, body: any): IntakeLeadPayload {
  const property = firstProperty(body) || {};
  const foreclosure = property?.foreclosure || {};
  const avm = property?.avm || property?.avmDetail || {};

  return {
    lead_type: request.lead_type || clean(foreclosure?.distressType) || 'property_enrichment',
    owner_name: request.owner_name || ownerName(property),
    email: request.email,
    phone: request.phone,
    property_address: oneLineAddress(property, request.address || [request.address1, request.address2].filter(Boolean).join(' ')),
    property_city: clean(property?.address?.locality),
    property_state: clean(property?.address?.countrySubd),
    property_zip: clean(property?.address?.postal1),
    county: request.county || clean(property?.area?.countrysecsubd),
    filing_date: request.filing_date || clean(foreclosure?.recordingDate) || clean(foreclosure?.auctionDateTime),
    case_number: request.case_number || clean(foreclosure?.documentNumber) || clean(foreclosure?.trusteeSaleNumber),
    source_provider: 'attom',
    estimated_equity: request.estimated_equity,
    estimated_value: num(avm?.amount?.value) || num(avm?.value),
    attom_id: clean(property?.identifier?.attomId),
    provider_record_id: clean(property?.identifier?.attomId) || clean(property?.identifier?.Id),
    tags: Array.from(new Set([...(request.tags || []), 'api-source-commercial', 'attom']))
  };
}

async function fetchAttomProperty(env: Env, payload: AttomPropertyRequest): Promise<any> {
  const baseUrl = env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/property/basicprofile`);

  if (payload.address) {
    url.searchParams.set('address', payload.address);
  } else {
    if (!payload.address1 || !payload.address2) {
      throw new Error('ATTOM request requires address or address1/address2.');
    }
    url.searchParams.set('address1', payload.address1);
    url.searchParams.set('address2', payload.address2);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      APIKey: env.ATTOM_API_KEY || ''
    }
  });

  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`ATTOM property lookup failed ${res.status}: ${text}`);
  }

  return body;
}

async function processAttomLead(env: Env, payload: IntakeLeadPayload, attomBody: any): Promise<Response> {
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
      message: 'Duplicate ATTOM lead blocked before GHL creation.'
    });
  }

  const feeder = evaluateDistributionReadiness(compliantLead);

  await env.RAW_PAYLOADS.put(
    `${cloudflareRecordRef}.attom.json`,
    JSON.stringify({ receivedAt: new Date().toISOString(), payload, attomBody, compliance, feeder }, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );

  if (!payload.email && !payload.phone) {
    return Response.json({
      ok: true,
      duplicate: false,
      pending: true,
      route: 'skip_trace',
      cloudflareRecordRef,
      dedupeKey: dedupe.dedupeKey,
      message: 'ATTOM property matched and stored. Contact sync is pending email/phone append.',
      compliance,
      feeder,
      lead: compliantLead,
      attom: {
        matched: Boolean(firstProperty(attomBody)),
        status: attomBody?.status
      }
    }, { status: 202 });
  }

  const routedLead = applyDistributionDecision(compliantLead, feeder);
  const ghl = await createOrUpdateGhlContact(env, routedLead);

  return Response.json({
    ok: true,
    duplicate: false,
    cloudflareRecordRef,
    dedupeKey: dedupe.dedupeKey,
    ghl,
    compliance,
    feeder,
    lead: routedLead,
    attom: {
      matched: Boolean(firstProperty(attomBody)),
      status: attomBody?.status
    }
  });
}

export function attomStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'attom',
    configured: Boolean(env.ATTOM_API_KEY),
    baseUrl: env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
  });
}

export async function attomPropertyRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.ATTOM_API_KEY) {
      return Response.json({ ok: false, error: 'ATTOM_API_KEY is not configured.' }, { status: 503 });
    }

    if (!env.GHL_API_TOKEN) {
      return Response.json({ ok: false, error: 'GHL_API_TOKEN is not configured.' }, { status: 503 });
    }

    const payload = await request.json() as AttomPropertyRequest;
    const attomBody = await fetchAttomProperty(env, payload);
    const lead = mapAttomToLead(payload, attomBody);

    return processAttomLead(env, lead, attomBody);
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown ATTOM integration error'
    }, { status: 500 });
  }
}
