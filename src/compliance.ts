import type { NormalizedLead } from './types';

export interface ComplianceDecision {
  status: 'approved' | 'needs_review' | 'blocked';
  canCall: boolean;
  canText: boolean;
  canEmail: boolean;
  canDirectMail: boolean;
  reason: string;
  tags: string[];
}

const SENSITIVE_TYPES = new Set(['divorce', 'probate', 'foreclosure', 'pre_foreclosure', 'lis_pendens']);

export function evaluateCompliance(lead: NormalizedLead): ComplianceDecision {
  const tags = new Set<string>();

  if (SENSITIVE_TYPES.has(lead.leadType)) {
    tags.add('needs-compliance-review');
    tags.add('manual-review-required');

    if (lead.leadType === 'divorce' || lead.leadType === 'probate') {
      tags.add('manual-review-only');
      return {
        status: 'needs_review',
        canCall: false,
        canText: false,
        canEmail: false,
        canDirectMail: true,
        reason: 'Sensitive legal/life-event lead requires manual review before outreach.',
        tags: Array.from(tags)
      };
    }
  }

  if (!lead.phone && !lead.email && !lead.propertyAddress) {
    tags.add('api-feed-do-not-distribute');
    return {
      status: 'blocked',
      canCall: false,
      canText: false,
      canEmail: false,
      canDirectMail: false,
      reason: 'No usable contact or property address available.',
      tags: Array.from(tags)
    };
  }

  if (lead.phone) tags.add('needs-dnc-check');
  if (!lead.phone) tags.add('needs-skip-trace');

  return {
    status: SENSITIVE_TYPES.has(lead.leadType) ? 'needs_review' : 'approved',
    canCall: false,
    canText: false,
    canEmail: Boolean(lead.email),
    canDirectMail: Boolean(lead.propertyAddress),
    reason: SENSITIVE_TYPES.has(lead.leadType)
      ? 'High-risk public record source requires compliance review and DNC clearance.'
      : 'Lead may proceed to non-call outreach path unless DNC/TCPA clearance is later confirmed.',
    tags: Array.from(tags)
  };
}

export function applyComplianceDecision(lead: NormalizedLead, decision: ComplianceDecision): NormalizedLead {
  return {
    ...lead,
    complianceStatus: decision.status,
    tags: Array.from(new Set([...lead.tags, ...decision.tags, `compliance-${decision.status}`]))
  };
}
