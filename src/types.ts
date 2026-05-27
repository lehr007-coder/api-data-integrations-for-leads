export interface IntakeLeadPayload {
  lead_type?: string;
  owner_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  county?: string;
  filing_date?: string;
  case_number?: string;
  source_provider?: string;
  estimated_equity?: number;
  estimated_value?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface NormalizedLead {
  leadType: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  propertyAddress?: string;
  county?: string;
  filingDate?: string;
  caseNumber?: string;
  sourceProvider?: string;
  estimatedEquity?: number;
  estimatedValue?: number;
  tags: string[];
  complianceStatus: string;
  leadPriorityLabel: string;
  cloudflareRecordRef: string;
}
