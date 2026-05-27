# Claude Skill: API Data Integrations for Leads

## Purpose

This skill guides Claude, Claude Code, or Claude CoWork when working inside this repository.

The project builds a Cloudflare Workers + GoHighLevel public API lead-ingestion system for real estate public-record and distress-data sources, including:

- Lis Pendens
- Foreclosure / Pre-Foreclosure
- Divorce / Dissolution of Marriage
- Future: Probate, Code Violations, Tax Delinquency, Absentee Owners, FSBO, Expired Listings

## Primary Mission

Build a secure, scalable, compliance-aware API integration layer that receives lead data, normalizes it, deduplicates it, enriches it if permitted, and pushes it into GoHighLevel for CRM automation.

## Required Architecture

Claude must preserve this architecture unless explicitly instructed otherwise:

```text
External Data Provider / Court Data Export
        ↓
Cloudflare Worker Endpoint
        ↓
Webhook Signature Validation
        ↓
Lead Normalization
        ↓
Deduplication
        ↓
Cloudflare Queue
        ↓
GoHighLevel Public API
        ↓
GHL Contact / Tags / Custom Fields / Workflows / AI Agent
```

## Cloudflare Components

Use these where appropriate:

- Workers for HTTP endpoints and business logic
- KV for dedupe keys, settings, and lightweight state
- Queues for async contact creation and retries
- R2 for raw payload archival
- Durable Objects for sync locks and per-county cursor state
- Cron Triggers for polling public data providers

## GoHighLevel Components

Use GHL-native tools first:

- Contacts API
- Tags
- Custom Fields
- Workflows
- Opportunities / Pipelines
- Custom Objects, when available and appropriate
- AI Agent Studio handoff workflows
- Marketplace/public app OAuth structure where needed

## Important Development Rules

1. Do not hard-code API keys, access tokens, webhook secrets, location IDs, or provider credentials.
2. Use environment variables for all secrets.
3. Never commit real customer data, court records, private lead data, or sample payloads containing real people.
4. Use synthetic sample data only.
5. Preserve compliance warnings in docs and code comments.
6. Design every endpoint to reject unauthorized requests.
7. Deduplicate before creating contacts in GHL.
8. Store raw payload archives only if legally permitted by source-provider terms.
9. Add structured logs without exposing sensitive personal data.
10. Prefer incremental pull requests over large destructive rewrites.

## Data Normalization Standard

All source data should normalize into this shape before pushing to GHL:

```ts
export interface NormalizedLead {
  source: string;
  leadType: 'lis_pendens' | 'foreclosure' | 'pre_foreclosure' | 'divorce' | 'probate' | 'unknown';
  caseNumber?: string;
  filingDate?: string;
  county?: string;
  state?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  mailingAddress?: string;
  estimatedEquity?: number;
  estimatedValue?: number;
  attorneyName?: string;
  courtUrl?: string;
  rawSourceId?: string;
  tags: string[];
}
```

## GHL Push Rules

When pushing into GHL:

- Search for an existing contact first when possible.
- Match by email, phone, or a deterministic dedupe key.
- Create contact only when no match exists.
- Apply source tags.
- Populate custom fields only when values are present.
- Add a note summarizing the filing source and date.
- Trigger workflows through GHL tags, workflow webhooks, or custom fields.

## Default Tags

Use these tag conventions:

- `public-record-lead`
- `lis-pendens`
- `foreclosure`
- `pre-foreclosure`
- `divorce-lead`
- `broward-county`
- `miami-dade-county`
- `palm-beach-county`
- `needs-skip-trace`
- `needs-review`
- `do-not-call-check-required`

## Compliance Requirements

Claude must preserve and enforce compliance reminders:

- TCPA compliance is required before calls or SMS.
- DNC checks should happen before outbound dialing.
- CAN-SPAM applies to marketing email.
- Vendor data licensing terms control how records may be stored and used.
- Divorce-related outreach is sensitive and may require additional legal review.
- Florida public records access does not automatically mean marketing use is unrestricted.

Claude must not generate misleading, threatening, deceptive, or coercive outreach scripts.

## Recommended File Structure

```text
.claude/
  skill.md
  prompts/
    claude-code-build.md
    ghl-workflow-builder.md
    data-provider-research.md

src/
  index.ts
  ghl.ts
  normalize.ts
  dedupe.ts
  compliance.ts
  types.ts

docs/
  architecture.md
  ghl-public-api.md
  cloudflare.md
  compliance.md
  provider-evaluation.md
```

## Claude Code Handoff Prompt

When handing off to Claude Code, use this operating instruction:

> You are working inside the `api-data-integrations-for-leads` repository. Build incrementally. Do not remove existing architecture or compliance notes. Implement Cloudflare Workers TypeScript endpoints that validate webhook secrets, normalize real estate public-record lead data, deduplicate records, and push compliant contacts into GoHighLevel using environment variables. Add tests or sample curl commands using synthetic data only.

## Success Criteria

The project is successful when:

- Cloudflare Worker receives a webhook payload.
- Payload is authenticated.
- Payload is normalized.
- Duplicate records are blocked.
- Valid records are pushed into GHL.
- Tags/custom fields are applied.
- Errors are logged safely.
- No real secrets or personal records are committed.
