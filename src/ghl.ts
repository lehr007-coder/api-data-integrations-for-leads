import type { NormalizedLead } from './types';

export interface Env {
  GHL_BASE_URL: string;
  GHL_LOCATION_ID: string;
  GHL_API_TOKEN?: string;
  WEBHOOK_SECRET?: string;
  ATTOM_API_KEY?: string;
  ATTOM_BASE_URL?: string;
  ATTOM_FORECLOSURE_ENDPOINT?: string;
  ATTOM_FORECLOSURE_SEARCHES?: string;
  DATA_GOV_API_KEY?: string;
  REOL_API_KEY?: string;
  SMARTY_AUTH_ID?: string;
  SMARTY_AUTH_TOKEN?: string;
  DEDUPE_KV: KVNamespace;
  RAW_PAYLOADS: R2Bucket;
  LEAD_QUEUE?: Queue;
}

export interface GhlSyncResult {
  ok: boolean;
  contactId?: string;
  error?: string;
}

export interface GhlActionResult {
  ok: boolean;
  noteId?: string;
  taskId?: string;
  errors?: string[];
}

function requireToken(env: Env): string {
  if (!env.GHL_API_TOKEN) {
    throw new Error('Missing GHL_API_TOKEN environment secret.');
  }
  return env.GHL_API_TOKEN;
}

function ghlHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${requireToken(env)}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

function buildContactPayload(env: Env, lead: NormalizedLead): Record<string, unknown> {
  const tags = Array.from(new Set(lead.tags.filter(Boolean)));

  return {
    locationId: env.GHL_LOCATION_ID,
    firstName: lead.firstName,
    lastName: lead.lastName,
    name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    address1: lead.propertyAddress,
    source: lead.sourceProvider || 'api-public-record',
    tags,
    customFields: [
      { key: 'lead_type', field_value: lead.leadType },
      { key: 'lead_source', field_value: lead.sourceProvider || 'api-public-record' },
      { key: 'seller_equity', field_value: lead.estimatedEquity ?? '' },
      { key: 'seller_estimated_value', field_value: lead.estimatedValue ?? '' },
      { key: 'lead_priority_label', field_value: lead.leadPriorityLabel },
      { key: 'compliance_status', field_value: lead.complianceStatus },
      { key: 'cloudflare_record_ref', field_value: lead.cloudflareRecordRef }
    ]
  };
}

export async function createOrUpdateGhlContact(env: Env, lead: NormalizedLead): Promise<GhlSyncResult> {
  const url = `${env.GHL_BASE_URL}/contacts/upsert`;
  const payload = buildContactPayload(env, lead);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: ghlHeaders(env),
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!res.ok) {
      return { ok: false, error: `GHL contact upsert failed ${res.status}: ${text}` };
    }

    return {
      ok: true,
      contactId: body?.contact?.id || body?.id || body?.contactId
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown GHL sync error' };
  }
}

export function buildGhlNote(lead: NormalizedLead): string {
  return [
    `API public-record lead imported.`,
    `Lead type: ${lead.leadType}`,
    lead.caseNumber ? `Case number: ${lead.caseNumber}` : undefined,
    lead.filingDate ? `Filing date: ${lead.filingDate}` : undefined,
    lead.county ? `County: ${lead.county}` : undefined,
    lead.propertyAddress ? `Property: ${lead.propertyAddress}` : undefined,
    `Priority: ${lead.leadPriorityLabel}`,
    `Compliance: ${lead.complianceStatus}`,
    `Cloudflare ref: ${lead.cloudflareRecordRef}`
  ].filter(Boolean).join('\n');
}

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function tomorrowIso(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

export async function createGhlContactNote(
  env: Env,
  contactId: string,
  body: string
): Promise<{ ok: boolean; noteId?: string; error?: string }> {
  const res = await fetch(`${env.GHL_BASE_URL}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: ghlHeaders(env),
    body: JSON.stringify({ body })
  });
  const parsed = await parseJsonResponse(res);

  if (!res.ok) {
    return { ok: false, error: `GHL note create failed ${res.status}: ${JSON.stringify(parsed)}` };
  }

  return { ok: true, noteId: parsed?.note?.id || parsed?.id || parsed?.noteId };
}

export async function createGhlContactTask(
  env: Env,
  contactId: string,
  lead: NormalizedLead
): Promise<{ ok: boolean; taskId?: string; error?: string }> {
  const title = `Review ${lead.sourceProvider || 'API'} ${lead.leadType} lead`;
  const body = [
    `Lead is distribution-ready after contact append and DNC/compliance check.`,
    lead.propertyAddress ? `Property: ${lead.propertyAddress}` : undefined,
    lead.email ? `Email: ${lead.email}` : undefined,
    lead.phone ? `Phone: ${lead.phone}` : undefined,
    `Cloudflare ref: ${lead.cloudflareRecordRef}`
  ].filter(Boolean).join('\n');

  const res = await fetch(`${env.GHL_BASE_URL}/contacts/${contactId}/tasks`, {
    method: 'POST',
    headers: ghlHeaders(env),
    body: JSON.stringify({
      title,
      body,
      dueDate: tomorrowIso(),
      completed: false
    })
  });
  const parsed = await parseJsonResponse(res);

  if (!res.ok) {
    return { ok: false, error: `GHL task create failed ${res.status}: ${JSON.stringify(parsed)}` };
  }

  return { ok: true, taskId: parsed?.task?.id || parsed?.id || parsed?.taskId };
}

export async function createReadyLeadActions(
  env: Env,
  contactId: string,
  lead: NormalizedLead
): Promise<GhlActionResult> {
  const errors: string[] = [];
  const note = await createGhlContactNote(env, contactId, buildGhlNote(lead));
  if (!note.ok && note.error) errors.push(note.error);

  const task = await createGhlContactTask(env, contactId, lead);
  if (!task.ok && task.error) errors.push(task.error);

  return {
    ok: errors.length === 0,
    noteId: note.noteId,
    taskId: task.taskId,
    errors: errors.length ? errors : undefined
  };
}
