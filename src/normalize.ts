import type { IntakeLeadPayload, NormalizedLead } from './types';

function splitName(fullName?: string): { firstName?: string; lastName?: string } {
  if (!fullName) return {};
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeLeadType(value?: string): string {
  const raw = (value || 'unknown').toLowerCase().replace(/[\s-]+/g, '_');
  if (raw.includes('lis')) return 'lis_pendens';
  if (raw.includes('foreclosure')) return 'foreclosure';
  if (raw.includes('pre_foreclosure')) return 'pre_foreclosure';
  if (raw.includes('divorce') || raw.includes('dissolution')) return 'divorce';
  if (raw.includes('probate')) return 'probate';
  if (raw.includes('legal') || raw.includes('filing') || raw.includes('court')) return 'legal_filing';
  if (raw.includes('tax')) return 'tax_delinquent';
  if (raw.includes('code')) return 'code_violation';
  return raw;
}

export function normalizeLead(payload: IntakeLeadPayload, cloudflareRecordRef: string): NormalizedLead {
  const nameParts = splitName(payload.owner_name);
  const leadType = normalizeLeadType(payload.lead_type);

  const baseTags = new Set<string>([
    'public-record-lead',
    `lead-type-${leadType}`,
    'api-source-public'
  ]);

  if (Array.isArray(payload.tags)) {
    for (const tag of payload.tags) baseTags.add(String(tag));
  }

  if (['lis_pendens', 'foreclosure', 'pre_foreclosure', 'divorce', 'probate', 'legal_filing'].includes(leadType)) {
    baseTags.add('api-risk-high');
    baseTags.add('needs-compliance-review');
  }

  if (['tax_delinquent', 'code_violation'].includes(leadType)) {
    baseTags.add('api-risk-medium');
  }

  if (leadType === 'divorce' || leadType === 'probate' || leadType === 'legal_filing') {
    baseTags.add('manual-review-only');
  }

  if (!payload.phone) baseTags.add('needs-skip-trace');
  if (payload.phone) baseTags.add('needs-dnc-check');

  return {
    leadType,
    fullName: payload.owner_name,
    firstName: payload.first_name || nameParts.firstName,
    lastName: payload.last_name || nameParts.lastName,
    email: payload.email,
    phone: payload.phone,
    propertyAddress: payload.property_address,
    county: payload.county,
    filingDate: payload.filing_date,
    caseNumber: payload.case_number,
    sourceProvider: payload.source_provider || 'unknown',
    estimatedEquity: payload.estimated_equity,
    estimatedValue: payload.estimated_value,
    tags: Array.from(baseTags),
    complianceStatus: 'needs_review',
    leadPriorityLabel: 'COLD',
    cloudflareRecordRef
  };
}
