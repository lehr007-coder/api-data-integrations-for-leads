# GHL Data Strategy: Use Existing Fields First

## Objective

Prevent GoHighLevel from becoming overloaded with raw public-record data.

Cloudflare should act as the processing and storage layer. GHL should only receive clean, actionable CRM fields that help the team follow up, score, route, and convert leads.

## Core Rule

Do not push raw API payloads directly into GHL contact fields.

Use this flow:

```text
API / Public Record Source
        ↓
Cloudflare Worker
        ↓
Normalize + Deduplicate + Score + Compliance Filter
        ↓
Store Raw Payload in R2 or KV Reference
        ↓
Push Only Actionable Summary Fields to GHL
```

## What Goes Into GHL

Only send:

- Lead type
- Lead source
- Property address
- Filing/case summary
- Urgency score
- Equity score
- Compliance status
- DNC status
- Recommended next action
- Tags
- Opportunity status
- Link/reference to archived raw data if needed

## What Stays Outside GHL

Keep in Cloudflare R2/KV/D1:

- Raw JSON payloads
- Full court records
- Full document text
- Repeated sync logs
- Large API responses
- Duplicate history
- Provider response archives
- Sensitive legal details

## Existing Field Strategy

Before creating any new GHL custom field, Claude or any automation must:

1. Search/use the existing GHL field list supplied by Scott.
2. Reuse current fields when semantically close.
3. Store extra detail in notes, tags, opportunities, or Cloudflare storage.
4. Only propose new fields if no existing field can safely fit the data.
5. Group new fields into a single minimal request list for manual approval.

## Recommended Existing-Field Mapping Pattern

Use existing/general fields first:

| Data Concept | Preferred GHL Storage |
|---|---|
| First name | Existing first name |
| Last name | Existing last name |
| Email | Existing email |
| Phone | Existing phone |
| Property address | Existing address/property address field |
| Lead source | Existing lead source/source field |
| Lead type | Existing lead type/contact type field if available |
| Notes | Contact notes |
| Tags | GHL tags |
| Pipeline stage | Existing opportunity pipeline |
| AI summary | Existing notes/dashboard/AI recommendation field if available |
| Raw payload | Cloudflare R2, not GHL |

## Minimal New Fields Only If Needed

If existing fields cannot cover the required data, propose only these minimal fields:

- public_record_type
- public_record_case_number
- public_record_filing_date
- public_record_county
- public_record_status
- compliance_status
- dnc_status
- api_source_provider
- api_last_sync_at
- cloudflare_record_ref

## Examples

### Lis Pendens Lead

Push to GHL:

- Contact name
- Property address
- Tag: lis-pendens
- Tag: api-risk-high
- Tag: needs-compliance-review
- Note: Lis pendens filed on [date], case [number], county [county].
- Opportunity: Public Record Seller Lead

Keep in Cloudflare:

- Full court payload
- Raw case details
- Document archive
- Sync history

### Foreclosure Lead

Push to GHL:

- Contact name
- Property address
- Auction date if present
- Estimated equity score if present
- Tag: foreclosure
- Tag: needs-dnc-check
- Task: Review before outreach

Keep in Cloudflare:

- Judgment details
- Full court docket
- Raw provider data

### Divorce Lead

Push to GHL:

- Contact name only if property match is confirmed
- Property address
- Tag: divorce-lead
- Tag: manual-review-only
- Note: Sensitive life-event source. Manual review required.

Keep in Cloudflare:

- Party details
- Legal allegations
- Full docket text
- Raw documents

## Automation Guardrails

Do not allow automatic SMS/calls unless:

- compliance_status = approved
- dnc_status = clear
- phone is present
- lead type is not blocked for auto outreach

Sensitive lead types default to manual review:

- divorce
- probate
- foreclosure
- eviction
- civil judgment

## GHL Should Be the Action Layer

GHL should answer:

- Who should we contact?
- Why are they a lead?
- What property is involved?
- How urgent is it?
- Is outreach allowed?
- What should happen next?

Cloudflare should answer:

- What did the original data say?
- Where did it come from?
- Was it already processed?
- What raw evidence supports it?
- What changed since the last sync?
