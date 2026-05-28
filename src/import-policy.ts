import type { Env } from './ghl';
import type { NormalizedLead } from './types';

export interface ImportPolicy {
  syncToGhl: boolean;
  dryRun: boolean;
  requireContactForGhl: boolean;
  allowedLeadTypes: string[];
  blockedLeadTypes: string[];
}

export interface ImportPolicyDecision {
  allowGhlSync: boolean;
  reason: string;
  policy: ImportPolicy;
}

const POLICY_KEY = 'admin/import-policy.json';

export const DEFAULT_IMPORT_POLICY: ImportPolicy = {
  syncToGhl: true,
  dryRun: false,
  requireContactForGhl: true,
  allowedLeadTypes: [
    'foreclosure',
    'pre_foreclosure',
    'lis_pendens',
    'divorce',
    'probate',
    'tax_delinquent',
    'code_violation',
    'legal_filing',
    'property_enrichment'
  ],
  blockedLeadTypes: []
};

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return Array.from(new Set(value.map(String).map((item) => item.trim()).filter(Boolean)));
}

function mergePolicy(input: Partial<ImportPolicy>): ImportPolicy {
  return {
    syncToGhl: typeof input.syncToGhl === 'boolean' ? input.syncToGhl : DEFAULT_IMPORT_POLICY.syncToGhl,
    dryRun: typeof input.dryRun === 'boolean' ? input.dryRun : DEFAULT_IMPORT_POLICY.dryRun,
    requireContactForGhl: typeof input.requireContactForGhl === 'boolean'
      ? input.requireContactForGhl
      : DEFAULT_IMPORT_POLICY.requireContactForGhl,
    allowedLeadTypes: normalizeList(input.allowedLeadTypes, DEFAULT_IMPORT_POLICY.allowedLeadTypes),
    blockedLeadTypes: normalizeList(input.blockedLeadTypes, DEFAULT_IMPORT_POLICY.blockedLeadTypes)
  };
}

export async function loadImportPolicy(env: Env): Promise<ImportPolicy> {
  const object = await env.RAW_PAYLOADS.get(POLICY_KEY);
  if (!object) return DEFAULT_IMPORT_POLICY;

  try {
    return mergePolicy(await object.json());
  } catch {
    return DEFAULT_IMPORT_POLICY;
  }
}

export async function saveImportPolicy(env: Env, input: Partial<ImportPolicy>): Promise<ImportPolicy> {
  const existing = await loadImportPolicy(env);
  const policy = mergePolicy({ ...existing, ...input });

  await env.RAW_PAYLOADS.put(
    POLICY_KEY,
    JSON.stringify({ ...policy, updatedAt: new Date().toISOString() }, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );

  return policy;
}

export async function resetImportPolicy(env: Env): Promise<ImportPolicy> {
  await env.RAW_PAYLOADS.put(
    POLICY_KEY,
    JSON.stringify({ ...DEFAULT_IMPORT_POLICY, updatedAt: new Date().toISOString() }, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );
  return DEFAULT_IMPORT_POLICY;
}

export async function evaluateImportPolicy(env: Env, lead: NormalizedLead): Promise<ImportPolicyDecision> {
  const policy = await loadImportPolicy(env);
  const leadType = lead.leadType;

  if (!policy.syncToGhl) {
    return { allowGhlSync: false, reason: 'GHL sync is disabled by admin import policy.', policy };
  }

  if (policy.dryRun) {
    return { allowGhlSync: false, reason: 'Dry-run mode is enabled by admin import policy.', policy };
  }

  if (policy.blockedLeadTypes.includes(leadType)) {
    return { allowGhlSync: false, reason: `${leadType} is blocked by admin import policy.`, policy };
  }

  if (!policy.allowedLeadTypes.includes(leadType)) {
    return { allowGhlSync: false, reason: `${leadType} is not allowed by admin import policy.`, policy };
  }

  if (policy.requireContactForGhl && !lead.email && !lead.phone) {
    return { allowGhlSync: false, reason: 'Lead needs email or phone before GHL sync.', policy };
  }

  return { allowGhlSync: true, reason: 'Lead is allowed to sync to GHL.', policy };
}

export async function storeImportHold(
  env: Env,
  cloudflareRecordRef: string,
  lead: NormalizedLead,
  decision: ImportPolicyDecision
): Promise<void> {
  await env.RAW_PAYLOADS.put(
    `${cloudflareRecordRef}.admin-hold.json`,
    JSON.stringify({ heldAt: new Date().toISOString(), decision, lead }, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );
}
