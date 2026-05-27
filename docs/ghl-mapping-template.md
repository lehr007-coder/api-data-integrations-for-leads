# GHL Mapping Template

## Purpose

Map the API Data Integrations for Leads system to the existing GoHighLevel location, fields, pipelines, objects, workflows, users, and routing rules.

Use existing fields first. Do not create new fields unless absolutely required.

## Known Location

```text
GHL_LOCATION_ID=SeZr4YCwEZ50IcWqylkQ
```

## Existing Field Names To Reuse First

```text
lead_source
lead_type
seller_score
seller_estimated_value
seller_equity
lead_intent_score
lead_priority_label
pipeline_suggestion
ai_recommendation_message
dashboard_master_json
activity_timeline
listing_address
last_webhook_received_at
last_webhook_processed
```

## Required Field ID Mapping

Fill in actual GHL custom field IDs before production writes.

| Logical Field | Existing GHL Field Name | GHL Field ID | Required | Notes |
|---|---|---:|---:|---|
| Lead Source | lead_source |  | Yes | Reuse existing field |
| Lead Type | lead_type |  | Yes | Reuse existing field |
| Seller Score | seller_score |  | Yes | Reuse existing field |
| Estimated Value | seller_estimated_value |  | Yes | Reuse existing field |
| Estimated Equity | seller_equity |  | Yes | Reuse existing field |
| Intent Score | lead_intent_score |  | Yes | Reuse existing field |
| Priority Label | lead_priority_label |  | Yes | Reuse existing field |
| Pipeline Suggestion | pipeline_suggestion |  | Yes | Reuse existing field |
| AI Recommendation | ai_recommendation_message |  | Yes | Reuse existing field |
| Activity Timeline | activity_timeline |  | Optional | Append-only note/log strategy preferred |
| Listing/Property Address | listing_address |  | Yes | Reuse existing field |
| Last Webhook Received | last_webhook_received_at |  | Optional | Existing sync field |
| Last Webhook Processed | last_webhook_processed |  | Optional | Existing sync field |
| Cloudflare Record Ref | cloudflare_record_ref |  | Optional New | Only if no existing reference field exists |
| Compliance Status | compliance_status |  | Optional New | Can also use tags/object |
| DNC Status | dnc_status |  | Optional New | Can also use tags/object |

## Pipeline Mapping

Use the existing seller or lead pipeline first.

| Purpose | Existing Pipeline Name | Pipeline ID | Notes |
|---|---|---:|---|
| Seller/Public Record Leads |  |  | Reuse existing seller pipeline |
| Distribution / Assignment |  |  | Existing lead router/round robin workflow |

## Stage Mapping

Map these logical stages to the closest existing stage.

| Logical Stage | Existing GHL Stage | Stage ID | Notes |
|---|---|---:|---|
| New API Lead |  |  | Initial intake |
| Needs Review |  |  | Manual review/compliance |
| Skip Trace Needed |  |  | No phone/contact data |
| DNC / Compliance Check |  |  | Before call/SMS |
| Ready for Outreach |  |  | Approved and contactable |
| Contacted |  |  | Outreach started |
| Appointment Set |  |  | Seller appointment |
| Listing Opportunity |  |  | Listing/disposition opportunity |
| Under Agreement |  |  | Deal in progress |
| Closed / Dead |  |  | Closed, dead, blocked, or disqualified |

## Custom Objects

Use objects wherever possible.

| Object | Object ID | Required | Purpose |
|---|---:|---:|---|
| Public Record Event |  | Yes | Repeat legal/public-record events |
| Property Intelligence |  | Yes | Property/equity/enrichment facts |
| Compliance Review |  | Yes | DNC/TCPA/manual review record |
| API Source Sync |  | Optional | Provider sync history/audit |

## Workflow Trigger Tags

Use tags as lightweight workflow triggers.

```text
api-intake-new-lead
api-intake-sensitive-lead
api-intake-enrichment-update
api-intake-duplicate-event
api-intake-ready-for-outreach
api-intake-needs-skip-trace
api-intake-needs-dnc-check
api-feed-distribution-ready
api-feed-sensitive-review
api-feed-skip-trace-first
api-feed-dnc-check-first
api-feed-direct-mail-only
api-feed-do-not-distribute
api-feed-routing-error
```

## Source Tags

```text
public-record-lead
lis-pendens
foreclosure
pre-foreclosure
divorce-lead
probate
tax-delinquent
code-violation
property-distress
api-risk-high
api-risk-medium
needs-compliance-review
needs-dnc-check
needs-skip-trace
manual-review-only
```

## Assignment / Lead Distribution

The feeder system should trigger the existing distribution workflow using:

```text
Tag added: api-feed-distribution-ready
```

Do not bypass the existing lead distribution workflow.

## Field Creation Rule

Before creating any field:

1. Use standard GHL fields.
2. Use existing custom fields.
3. Use tags for yes/no statuses.
4. Use Custom Objects for repeatable event data.
5. Use Cloudflare for raw/heavy data.
6. Only create new fields as a last resort.
