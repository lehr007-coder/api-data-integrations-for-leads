import type { NormalizedLead } from './types';

export function scoreLead(lead: NormalizedLead): NormalizedLead {
  let score = 0;

  if (lead.estimatedEquity && lead.estimatedEquity >= 100000) score += 25;
  if (lead.estimatedValue && lead.estimatedValue >= 300000) score += 10;
  if (lead.phone) score += 10;
  if (lead.email) score += 5;
  if (lead.propertyAddress) score += 10;

  switch (lead.leadType) {
    case 'foreclosure':
    case 'pre_foreclosure':
      score += 30;
      break;
    case 'lis_pendens':
      score += 25;
      break;
    case 'tax_delinquent':
    case 'code_violation':
      score += 15;
      break;
    case 'probate':
      score += 10;
      break;
    case 'divorce':
      score += 5;
      break;
  }

  let label = 'COLD';
  if (score >= 70) label = 'HOT';
  else if (score >= 40) label = 'WARM';

  return {
    ...lead,
    leadPriorityLabel: label,
    tags: Array.from(new Set([...lead.tags, `lead-priority-${label.toLowerCase()}`]))
  };
}
