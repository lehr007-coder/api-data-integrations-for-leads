# GHL Lead Routing and Trigger Process

## Objective

Every new lead coming from API/public-record data must be routed into the correct GHL location, contact, opportunity, object, tag set, and workflow trigger.

This prevents random contact creation and keeps the CRM organized.

## Core Rule

Cloudflare receives and processes the lead first. GHL only receives clean, routed, deduplicated, action-ready data.

```text
API Provider / Public Data Source
        ↓
Cloudflare Intake Endpoint
        ↓
Normalize + Dedupe + Score + Compliance Filter
        ↓
Determine Routing Destination
        ↓
Create/Update GHL Contact
        ↓
Create/Update GHL Object
        ↓
Create/Update Opportunity in Existing Pipeline
        ↓
Apply Trigger Tag / Field
        ↓
Run GHL Workflow
```

## Required Routing Decisions

Before sending to GHL, Cloudflare must determine:

1. Which GHL location/subaccount receives the lead.
2. Whether the person already exists as a Contact.
3. Whether an Opportunity already exists for that property/person.
4. Which existing pipeline should be used.
5. Which existing stage should be used.
6. Which Custom Object should receive the event.
7. Which tags should be applied.
8. Which trigger field or tag should start the workflow.
9. Whether manual compliance review is required.
10. Whether outreach is allowed.

## Default Location Routing

Use the existing GHL location unless configured otherwise.

Recommended default:

- The Listing Team / Real Listing Agent location for real estate seller leads.

Future routing may include:

- Complete Choice Title for title-related leads.
- AI InteliCall Solutions for AI service leads.
- Investor/wholesale subaccount if created.

Do not create duplicate contacts across subaccounts unless a routing rule requires it.

## Existing Pipeline Strategy

Do not create one pipeline per lead source.

Use existing seller or lead pipeline first.

Recommended general stage flow:

1. New API Lead
2. Needs Review
3. Skip Trace Needed
4. DNC / Compliance Check
5. Ready for Outreach
6. Contacted
7. Appointment Set
8. Listing Opportunity
9. Under Agreement
10. Closed / Dead

If these stages do not exist, map to the closest existing stages before proposing new ones.

## Lead-Type Routing Examples

### Lis Pendens

Destination:

- Existing seller pipeline
- Stage: Needs Review
- Object: Public Record Event

Tags:

- public-record-lead
- lis-pendens
- api-risk-high
- needs-compliance-review
- needs-dnc-check

Trigger:

- Tag added: api-intake-new-lead
- Tag added: lis-pendens

Workflow:

- API Lead Intake Workflow
- Compliance Review Workflow

### Foreclosure / Pre-Foreclosure

Destination:

- Existing seller pipeline
- Stage: Needs Review or Urgent Review if auction date is close
- Object: Public Record Event
- Object: Property Intelligence

Tags:

- public-record-lead
- foreclosure
- pre-foreclosure
- api-risk-high
- needs-dnc-check

Trigger:

- Tag added: api-intake-new-lead
- Tag added: foreclosure

Workflow:

- API Lead Intake Workflow
- Foreclosure Priority Workflow
- Compliance Review Workflow

### Divorce

Destination:

- Existing seller pipeline only if property ownership match is confirmed
- Stage: Manual Review / Needs Review
- Object: Public Record Event

Tags:

- public-record-lead
- divorce-lead
- manual-review-only
- api-risk-high
- needs-compliance-review

Trigger:

- Tag added: api-intake-sensitive-lead

Workflow:

- Sensitive Lead Manual Review Workflow

Rule:

- Do not trigger auto-call or auto-SMS.

### Probate

Destination:

- Existing seller pipeline
- Stage: Manual Review / Needs Review
- Object: Public Record Event

Tags:

- public-record-lead
- probate
- estate-lead
- needs-compliance-review

Trigger:

- Tag added: api-intake-sensitive-lead

Workflow:

- Sensitive Lead Manual Review Workflow

### Tax Delinquency

Destination:

- Existing seller pipeline
- Stage: DNC / Compliance Check or Ready for Outreach depending on data quality
- Object: Public Record Event
- Object: Property Intelligence

Tags:

- public-record-lead
- tax-delinquent
- property-distress
- api-risk-medium

Trigger:

- Tag added: api-intake-new-lead

Workflow:

- API Lead Intake Workflow

### Code Violation

Destination:

- Existing seller pipeline
- Stage: DNC / Compliance Check
- Object: Public Record Event
- Object: Property Intelligence

Tags:

- public-record-lead
- code-violation
- property-distress
- api-risk-medium

Trigger:

- Tag added: api-intake-new-lead

Workflow:

- API Lead Intake Workflow

## Trigger Tag Standard

Use one of these trigger tags to start GHL workflows:

- api-intake-new-lead
- api-intake-sensitive-lead
- api-intake-enrichment-update
- api-intake-duplicate-event
- api-intake-ready-for-outreach
- api-intake-needs-skip-trace
- api-intake-needs-dnc-check

## Trigger Field Standard

If tags are not sufficient, use existing fields first. If a trigger field is needed, use or propose:

- last_api_event_type
- last_api_sync_at
- api_intake_status
- compliance_status
- lead_priority_label

## Object Creation Standard

Every accepted public-record event should create or update a Public Record Event Custom Object record.

Object fields should include:

- event_type
- event_date
- case_number
- source_provider
- source_url
- county
- property_address
- risk_level
- compliance_status
- event_summary
- cloudflare_record_ref
- duplicate_key
- processed_at

## Opportunity Creation Standard

Create an Opportunity only if the record represents a real potential seller opportunity.

Do create opportunities for:

- confirmed owner + property match
- foreclosure
- lis pendens
- tax delinquency
- probate with property match
- code violation with owner match

Do not create opportunities for:

- low-confidence matches
- duplicate sync events
- enrichment-only records
- unverified divorce-only records with no property match

## Deduplication Standard

Before GHL creation, generate a deterministic dedupe key:

```text
source_provider + lead_type + case_number + property_address + owner_name
```

If duplicate:

- Do not create a new Contact.
- Do not create a new Opportunity.
- Update the existing Public Record Event object if needed.
- Add/update a note only if the status materially changed.
- Apply tag: api-intake-duplicate-event if workflow review is needed.

## Existing Field First Rule

Before creating any new Contact field:

1. Use standard GHL fields.
2. Reuse Scott's existing custom fields.
3. Use tags for simple categories.
4. Use Custom Objects for repeat events.
5. Use Cloudflare for raw/heavy data.
6. Only propose new fields if absolutely necessary.

## GHL Workflow Trigger Design

### Workflow 1: API Lead Intake Workflow

Trigger:

- Contact tag added: api-intake-new-lead

Actions:

1. Remove trigger tag after start if needed.
2. Check lead type.
3. Check compliance status.
4. Create internal notification/task.
5. Move opportunity to correct stage.
6. Branch to skip trace, DNC, sensitive review, or outreach-ready.

### Workflow 2: Sensitive Lead Manual Review Workflow

Trigger:

- Contact tag added: api-intake-sensitive-lead

Actions:

1. Assign task to team member.
2. Set stage to Needs Review / Manual Review.
3. Prevent auto SMS/call.
4. Wait for manual approval.
5. Only after approval, move to next workflow.

### Workflow 3: Ready for Outreach Workflow

Trigger:

- Contact tag added: api-intake-ready-for-outreach

Required conditions:

- compliance_status = approved
- dnc_status = clear
- phone or email exists
- lead type not blocked from automation

Actions:

1. Start seller nurture.
2. Create call task.
3. Start AI Agent only if permitted.
4. Log activity.

### Workflow 4: Skip Trace Needed Workflow

Trigger:

- Contact tag added: api-intake-needs-skip-trace

Actions:

1. Send to skip trace provider if configured.
2. Update contact after result.
3. Route to DNC check.

### Workflow 5: DNC Check Workflow

Trigger:

- Contact tag added: api-intake-needs-dnc-check

Actions:

1. Send phone to DNC/TCPA scrub provider if configured.
2. Update dnc_status.
3. Route to ready-for-outreach or direct-mail-only.

## Final Rule

Every API lead should enter GHL through one controlled trigger path.

Do not create contacts manually from multiple provider modules without passing through Cloudflare's routing engine.
