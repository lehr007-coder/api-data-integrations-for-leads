import type { NormalizedLead } from './types';

export interface DedupeResult {
  isDuplicate: boolean;
  dedupeKey: string;
}

export function buildDedupeKey(lead: NormalizedLead): string {
  const parts = [
    lead.sourceProvider || 'unknown',
    lead.leadType || 'unknown',
    lead.caseNumber || 'no-case',
    lead.propertyAddress || 'no-address',
    lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'no-name'
  ];

  return parts
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function checkAndStoreDedupe(
  kv: KVNamespace,
  lead: NormalizedLead
): Promise<DedupeResult> {
  const dedupeKey = buildDedupeKey(lead);
  const existing = await kv.get(dedupeKey);

  if (existing) {
    return { isDuplicate: true, dedupeKey };
  }

  await kv.put(
    dedupeKey,
    JSON.stringify({
      leadType: lead.leadType,
      propertyAddress: lead.propertyAddress,
      caseNumber: lead.caseNumber,
      sourceProvider: lead.sourceProvider,
      storedAt: new Date().toISOString()
    }),
    { expirationTtl: 60 * 60 * 24 * 365 }
  );

  return { isDuplicate: false, dedupeKey };
}
