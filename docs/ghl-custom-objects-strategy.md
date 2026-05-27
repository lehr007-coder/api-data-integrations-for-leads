# GHL Custom Objects Strategy for Public Record Lead System

## Objective

Use GoHighLevel Custom Objects whenever possible for repeatable public-record events, while keeping Contact fields clean and reusing Scott's existing fields first.

## Core Principle

Contacts should represent people.
Opportunities should represent deals.
Custom Objects should represent repeatable records, events, filings, and property intelligence.
Cloudflare should store raw/heavy data.

## Recommended Model

```text
Contact
  ↓ associated to
Opportunity
  ↓ associated to
Public Record Event Custom Object
  ↓ references
Cloudflare Raw Payload / Evidence Archive
```

## Why Use Objects

Use Custom Objects because public-record data is event-based and repeatable.

A single homeowner may have:

- multiple lis pendens filings
- multiple foreclosure events
- a tax delinquency
- a code violation
- permit history
- ownership/property updates
- skip trace updates
- multiple API syncs

Do not create a new Contact field for every event.

## What Goes on the Contact

Use existing standard fields and existing custom fields first:

- first name
- last name
- phone
- email
- address
- lead source
- lead type
- seller score
- seller estimated value
- seller equity
- lead intent score
- lead priority label
- pipeline suggestion
- AI recommendation message
- last webhook received at
- last webhook processed

The Contact should only show the current best summary.

## What Goes on the Opportunity

Use opportunities for the active deal.

Recommended opportunity data:

- property address
- opportunity source
- opportunity value estimate
- pipeline stage
- urgency level
- assigned user
- next task date
- appointment status
- listing potential

## What Goes in Custom Objects

### Object 1: Public Record Event

Use for filings and trigger events.

Fields:

- event_type
- event_date
- case_number
- source_provider
- source_url
- county
- state
- property_address
- owner_name
- risk_level
- compliance_status
- dnc_status
- event_summary
- cloudflare_record_ref
- duplicate_key
- processed_at

Examples:

- LIS_PENDENS_FILED
- FORECLOSURE_FILED
- AUCTION_DATE_SET
- DIVORCE_FILED
- PROBATE_OPENED
- TAX_DELINQUENCY_FOUND
- CODE_VIOLATION_FOUND

### Object 2: Property Intelligence

Use for property facts and enrichment.

Fields:

- parcel_id
- property_address
- owner_name
- mailing_address
- homestead_status
- owner_occupied
- absentee_owner
- assessed_value
- estimated_market_value
- estimated_equity
- mortgage_balance_estimate
- last_sale_date
- last_sale_price
- beds
- baths
- square_feet
- year_built
- flood_zone
- property_risk_summary
- last_verified_at

### Object 3: API Source Sync

Use for provider sync history and system audit.

Fields:

- provider_name
- provider_record_id
- sync_started_at
- sync_completed_at
- sync_status
- records_found
- records_created
- records_updated
- records_skipped_duplicate
- error_message
- cloudflare_batch_ref

### Object 4: Compliance Review

Use for high-risk data review.

Fields:

- review_type
- lead_type
- risk_level
- compliance_status
- dnc_status
- tcpa_status
- reviewer
- review_notes
- approved_for_sms
- approved_for_call
- approved_for_email
- approved_for_direct_mail
- reviewed_at

## Contact-to-Object Relationship

Each Public Record Event should be associated to the Contact when a person/property match is confident.

If match confidence is low, keep the event in Cloudflare until reviewed.

## Object-First Examples

### Lis Pendens

Contact gets:

- name
- phone/email if available
- property address
- current lead score
- tags: lis-pendens, public-record-lead, needs-review

Public Record Event object gets:

- case number
- filing date
- county
- court source
- event summary
- risk level
- compliance status
- Cloudflare reference

Cloudflare gets:

- raw docket
- full JSON payload
- source archive

### Foreclosure

Contact gets:

- current priority label
- seller score
- property address
- tags: foreclosure, needs-dnc-check

Public Record Event object gets:

- foreclosure filing
- auction date
- judgment amount if legally usable
- case status
- source provider

Property Intelligence object gets:

- equity estimate
- estimated value
- ownership facts
- property condition indicators

### Divorce

Contact gets:

- only clean property/contact summary
- tag: manual-review-only

Public Record Event object gets:

- event type
- filing date
- case number
- manual review flag
- limited summary only

Cloudflare gets:

- raw case data if permitted

## Automation Rules

GHL workflows should trigger from tags, contact fields, or object creation events when available.

Recommended trigger logic:

- New Public Record Event created
- Tag added: public-record-lead
- Compliance status changed to approved
- Lead priority label changed to HOT
- DNC status changed to clear

## Do Not Do This

Do not create separate Contact fields for:

- every filing type
- every court status
- every API provider field
- every property fact
- every historical event

Do not create separate pipelines for each lead type unless the sales process is truly different.

Do not store raw payloads in GHL Custom Objects if the payload is large or sensitive.

## Existing Field Rule

Before creating any new Contact field:

1. Check Scott's existing GHL field list.
2. Use standard fields first.
3. Reuse existing seller/intelligence/scoring fields.
4. Use Tags for yes/no categories.
5. Use Custom Objects for repeatable event history.
6. Use Cloudflare for raw/heavy data.
7. Only propose new Contact fields if absolutely necessary.

## Minimal New Contact Fields If Required

Only propose these if no existing fields exist:

- public_record_type
- public_record_status
- compliance_status
- dnc_status
- api_source_provider
- api_last_sync_at
- cloudflare_record_ref

## Bottom Line

Use GHL this way:

```text
Contacts = people and current lead summary
Opportunities = active seller deal
Objects = repeatable events and property intelligence
Cloudflare = raw/heavy/source data
Tags = segmentation and workflow triggers
Existing fields = first choice before creating anything new
```
