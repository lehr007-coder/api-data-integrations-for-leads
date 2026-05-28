import { normalizeLead } from '../normalize';
import { scoreLead } from '../score';
import { evaluateCompliance, applyComplianceDecision } from '../compliance';
import { checkAndStoreDedupe } from '../dedupe';
import { createOrUpdateGhlContact, type Env } from '../ghl';
import { evaluateDistributionReadiness, applyDistributionDecision } from '../distribution-feeder';
import { evaluateImportPolicy, storeImportHold } from '../import-policy';
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

interface AttomBatchRequest {
  items?: AttomPropertyRequest[];
}

interface AttomForeclosureSearch {
  name?: string;
  params?: Record<string, string | number | boolean | undefined>;
  limit?: number;
}

interface AttomForeclosureFeedRequest {
  searches?: AttomForeclosureSearch[];
  params?: Record<string, string | number | boolean | undefined>;
  limit?: number;
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

function boundedFeedLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 25;
  return Math.min(parsed, 100);
}

function setParams(url: URL, params?: Record<string, string | number | boolean | undefined>): void {
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
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

async function fetchAttomForeclosureFeed(
  env: Env,
  search: AttomForeclosureSearch
): Promise<any> {
  const baseUrl = env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  const endpoint = env.ATTOM_FORECLOSURE_ENDPOINT
    || `${baseUrl.replace(/\/$/, '')}/preforeclosuredetails`;
  const url = new URL(endpoint);
  setParams(url, search.params);
  url.searchParams.set('pageSize', String(boundedFeedLimit(search.limit)));

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
    throw new Error(`ATTOM foreclosure feed failed ${res.status}: ${text}`);
  }

  return body;
}

function recordValue(record: any, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(record?.[key]);
    if (value) return value;
  }
  return undefined;
}

function recordNumber(record: any, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function inferForeclosureLeadType(recordType?: string): string {
  const normalized = (recordType || '').toLowerCase();
  if (normalized.includes('lis')) return 'lis_pendens';
  if (normalized.includes('reo')) return 'foreclosure';
  if (normalized.includes('auction') || normalized.includes('sale') || ['nts', 'nos'].includes(normalized)) {
    return 'foreclosure';
  }
  return 'pre_foreclosure';
}

function foreclosureAddress(identification: any, fallback: any): string | undefined {
  return clean(identification?.streetAddress)
    || clean(fallback?._StreetAddress)
    || [fallback?.line1, fallback?.locality, fallback?.countrySubd, fallback?.postal1]
      .map(clean)
      .filter(Boolean)
      .join(' ')
    || undefined;
}

function isForeclosureLike(record: any): boolean {
  return Boolean(
    record?.Default
    || record?.Auction
    || record?.PropertyIdentification
    || record?.foreclosureID
    || record?.foreclosureRecordingDate
    || record?.recordType
    || record?.property?.foreclosure
  );
}

function findForeclosureRecords(body: any): any[] {
  const candidates: any[][] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      if (node.some(isForeclosureLike)) {
        candidates.push(node.filter((item) => item && typeof item === 'object'));
      }
      for (const item of node) visit(item);
      return;
    }
    for (const value of Object.values(node)) visit(value);
  };

  visit(body);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || [];
}

function mapForeclosureRecordToLead(record: any): IntakeLeadPayload {
  const defaultRecord = record.Default || record.default || record;
  const auction = record.Auction || record.auction || {};
  const identification = record.PropertyIdentification || record.propertyIdentification || record.property || {};
  const recordType = recordValue(defaultRecord, 'recordType', 'distressType') || recordValue(record, 'recordType');
  const foreclosureId = recordValue(defaultRecord, 'foreclosureID') || recordValue(auction, 'foreclosureID') || recordValue(record, 'foreclosureID');
  const borrower = recordValue(defaultRecord, 'borrowerNameOwner', 'borrowerName') || ownerName(record);

  return {
    lead_type: inferForeclosureLeadType(recordType),
    owner_name: borrower,
    property_address: foreclosureAddress(identification, record.address || record),
    property_city: recordValue(identification, 'city') || recordValue(record.address, 'locality'),
    property_state: recordValue(identification, 'stateCode') || recordValue(record.address, 'countrySubd'),
    property_zip: recordValue(identification, 'zip5') || recordValue(record.address, 'postal1'),
    county: recordValue(record, 'county', 'countyName', 'countyFIPSName'),
    filing_date: recordValue(defaultRecord, 'foreclosureRecordingDate', 'foreclosureInstrumentDate', 'judgmentDate')
      || recordValue(auction, 'auctionDate'),
    case_number: recordValue(defaultRecord, 'caseNumber', 'foreclosureInstrumentNumber', 'trusteeReferenceNumber'),
    source_provider: 'attom_foreclosure_feed',
    estimated_value: recordNumber(record, 'estimatedValue', 'avmValue'),
    provider_record_id: foreclosureId || recordValue(identification, 'ATTOMID', 'attomId'),
    attom_id: recordValue(identification, 'ATTOMID', 'attomId'),
    tags: Array.from(new Set([
      'api-source-commercial',
      'attom',
      'foreclosure-feed',
      recordType ? `attom-record-${recordType.toLowerCase()}` : undefined
    ].filter(Boolean) as string[]))
  };
}

function parseConfiguredForeclosureSearches(env: Env): AttomForeclosureSearch[] {
  if (!env.ATTOM_FORECLOSURE_SEARCHES) return [];
  try {
    const parsed = JSON.parse(env.ATTOM_FORECLOSURE_SEARCHES);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    return [];
  }
  return [];
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
  const importDecision = await evaluateImportPolicy(env, routedLead);

  if (!importDecision.allowGhlSync) {
    await storeImportHold(env, cloudflareRecordRef, routedLead, importDecision);
    return Response.json({
      ok: true,
      duplicate: false,
      route: 'admin_hold',
      cloudflareRecordRef,
      dedupeKey: dedupe.dedupeKey,
      importPolicy: importDecision,
      compliance,
      feeder,
      lead: routedLead,
      attom: {
        matched: Boolean(firstProperty(attomBody)),
        status: attomBody?.status
      }
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

export async function attomBatchRoute(request: Request, env: Env): Promise<Response> {
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

    const payload = await request.json() as AttomBatchRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return Response.json({ ok: false, error: 'items array is required.' }, { status: 400 });
    }

    if (items.length > 25) {
      return Response.json({ ok: false, error: 'Batch limit is 25 items.' }, { status: 400 });
    }

    const results = [];
    for (let index = 0; index < items.length; index += 1) {
      try {
        const item = items[index];
        const attomBody = await fetchAttomProperty(env, item);
        const lead = mapAttomToLead(item, attomBody);
        const response = await processAttomLead(env, lead, attomBody);
        const body: any = await response.json();
        results.push({
          index,
          status: response.status,
          ok: body.ok === true,
          cloudflareRecordRef: body.cloudflareRecordRef,
          duplicate: body.duplicate,
          pending: body.pending,
          route: body.route || body.feeder?.route,
          ghl: body.ghl,
          error: body.error
        });
      } catch (error) {
        results.push({
          index,
          status: 500,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown ATTOM batch item error'
        });
      }
    }

    return Response.json({
      ok: results.some((result) => result.ok),
      total: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results
    }, { status: results.some((result) => result.ok) ? 207 : 500 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown ATTOM batch error'
    }, { status: 500 });
  }
}

async function runForeclosureSearches(
  env: Env,
  searches: AttomForeclosureSearch[]
): Promise<Record<string, unknown>> {
  const results = [];
  for (const search of searches) {
    try {
      const feedBody = await fetchAttomForeclosureFeed(env, search);
      const records = findForeclosureRecords(feedBody).slice(0, boundedFeedLimit(search.limit));
      const items = [];

      for (let index = 0; index < records.length; index += 1) {
        const rawRecord = records[index];
        const lead = mapForeclosureRecordToLead(rawRecord);
        const response = await processAttomLead(env, lead, {
          provider: 'attom',
          feed: 'preforeclosuredetails',
          search: search.name,
          rawRecord
        });
        const body: any = await response.json();
        items.push({
          index,
          ok: body.ok === true,
          status: response.status,
          duplicate: body.duplicate,
          pending: body.pending,
          route: body.route || body.feeder?.route,
          cloudflareRecordRef: body.cloudflareRecordRef,
          leadType: body.lead?.leadType || lead.lead_type,
          propertyAddress: body.lead?.propertyAddress || lead.property_address,
          error: body.error
        });
      }

      results.push({
        name: search.name,
        ok: true,
        fetched: records.length,
        newRecords: items.filter((item) => item.ok && !item.duplicate).length,
        duplicates: items.filter((item) => item.duplicate).length,
        items
      });
    } catch (error) {
      results.push({
        name: search.name,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown ATTOM foreclosure feed error'
      });
    }
  }

  await env.RAW_PAYLOADS.put(
    `monitor-runs/attom-foreclosures-${new Date().toISOString()}.json`,
    JSON.stringify({ ranAt: new Date().toISOString(), searches: results }, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );

  return {
    ok: results.some((result: any) => result.ok),
    totalSearches: results.length,
    results
  };
}

export async function attomForeclosureFeedRoute(request: Request, env: Env): Promise<Response> {
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

    const payload = await request.json() as AttomForeclosureFeedRequest;
    const searches = Array.isArray(payload.searches) && payload.searches.length
      ? payload.searches
      : [{ name: 'manual', params: payload.params, limit: payload.limit }];

    return Response.json(await runForeclosureSearches(env, searches));
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown ATTOM foreclosure feed error'
    }, { status: 500 });
  }
}

export async function runAttomForeclosureMonitor(env: Env): Promise<Record<string, unknown>> {
  if (!env.ATTOM_API_KEY) {
    return { ok: false, skipped: true, error: 'ATTOM_API_KEY is not configured.' };
  }

  if (!env.GHL_API_TOKEN) {
    return { ok: false, skipped: true, error: 'GHL_API_TOKEN is not configured.' };
  }

  const searches = parseConfiguredForeclosureSearches(env);
  if (!searches.length) {
    return { ok: true, skipped: true, message: 'ATTOM_FORECLOSURE_SEARCHES is not configured.' };
  }

  return runForeclosureSearches(env, searches);
}
