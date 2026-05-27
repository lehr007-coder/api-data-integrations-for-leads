import type { NormalizedLead } from './types';

export interface DistributionDecision {
  distribute: boolean;
  reason: string;
  tags: string[];
  route: 'manual_review' | 'skip_trace' | 'dnc_check' | 'ready' | 'blocked';
}

export function evaluateDistributionReadiness(lead: NormalizedLead): DistributionDecision {
  const tags = new Set<string>();

  if (lead.complianceStatus === 'blocked') {
    tags.add('api-feed-do-not-distribute');
    return {
      distribute: false,
      reason: 'Lead blocked by compliance gate.',
      tags: Array.from(tags),
      route: 'blocked'
    };
  }

  if (lead.tags.includes('manual-review-only') || lead.tags.includes('manual-review-required')) {
    tags.add('api-feed-sensitive-review');
    return {
      distribute: false,
      reason: 'Sensitive lead requires manual review before distribution.',
      tags: Array.from(tags),
      route: 'manual_review'
    };
  }

  if (lead.tags.includes('needs-skip-trace')) {
    tags.add('api-feed-skip-trace-first');
    return {
      distribute: false,
      reason: 'Lead requires skip trace before distribution.',
      tags: Array.from(tags),
      route: 'skip_trace'
    };
  }

  if (lead.tags.includes('needs-dnc-check')) {
    tags.add('api-feed-dnc-check-first');
    return {
      distribute: false,
      reason: 'Lead requires DNC/TCPA review before call/SMS distribution.',
      tags: Array.from(tags),
      route: 'dnc_check'
    };
  }

  tags.add('api-feed-distribution-ready');
  return {
    distribute: true,
    reason: 'Lead is distribution ready.',
    tags: Array.from(tags),
    route: 'ready'
  };
}

export function applyDistributionDecision(lead: NormalizedLead, decision: DistributionDecision): NormalizedLead {
  return {
    ...lead,
    tags: Array.from(new Set([...lead.tags, ...decision.tags]))
  };
}
