# Autonomous System Gap Analysis + Lead Distribution Feeder

## Objective

Define what is still missing to make the API Data Integrations for Leads project operate autonomously and define a separate feeder system that routes qualified API leads into the existing lead distribution system.

## Core Architecture

```text
Public / Paid API Data Sources
        ↓
Cloudflare Data Intake System
        ↓
Normalize + Deduplicate + Score + Compliance Filter
        ↓
Create/Update GHL Contact + Objects + Opportunity
        ↓
Lead Distribution Feeder System
        ↓
Existing GHL Lead Distribution / Round Robin / Assignment System
        ↓
Follow-up Workflows + AI Agent + Human Tasks
```

## System 1: API Data Intake System

Purpose:

- Receive API data
- Normalize lead records
- Deduplicate records
- Store raw data in Cloudflare
- Push clean records into GHL
- Create or update objects
- Apply routing tags and trigger fields

This system does NOT decide final salesperson/agent distribution unless configured to do so.

## System 2: Lead Distribution Feeder System

Purpose:

- Receive only qualified and routed leads from the intake system
- Prepare the lead for the existing GHL lead distribution workflow
- Apply assignment-ready tags/fields
- Prevent sensitive or non-compliant leads from being distributed too early
- Feed the current round-robin or assignment engine

This keeps the new API lead system separate from the existing distribution system.

## Missing Items To Make Fully Autonomous

### 1. Secrets and Credentials

Still required:

- GHL_API_TOKEN or OAuth credentials
- GHL_LOCATION_ID confirmed for production
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID confirmed for production
- WEBHOOK_SECRET generated for this project
- Provider API keys such as ATTOM, DataTree, skip trace, DNC, direct mail if used

### 2. GHL Internal IDs

Still required:

- Existing pipeline IDs
- Existing stage IDs
- Existing custom field IDs
- Existing custom object IDs
- Existing workflow trigger tags
- Existing user/team IDs for assignment

### 3. Cloudflare Resources

Still required:

- New Worker name
- KV namespace for dedupe keys
- R2 bucket for raw payloads
- Queue for async processing
- Optional D1 database for lead ledger and routing history
- Optional Durable Object for sync locks and provider cursors

### 4. Code Scaffold

Still required:

- package.json
- wrangler.toml
- src/index.ts
- src/routes/intake.ts
- src/routes/health.ts
- src/normalize.ts
- src/dedupe.ts
- src/score.ts
- src/compliance.ts
- src/ghl.ts
- src/distribution-feeder.ts
- src/types.ts
- GitHub Actions deployment workflow

### 5. Provider Selection

Still required:

- First production data source decision
- First free/public source decision
- Whether to start with CSV/manual upload, ATTOM, DataTree, county/GIS, or another provider

Recommended first provider path:

1. Synthetic test payloads
2. Manual CSV/webhook payload intake
3. County/GIS/public property enrichment
4. Paid provider such as ATTOM/DataTree after proof of concept

### 6. Compliance/DNC Decision

Still required:

- Choose DNC/TCPA scrub provider
- Define DNC clear/block status values
- Define compliance approval statuses
- Decide which lead types can be auto-called, auto-texted, emailed, direct mailed, or manual review only

### 7. Lead Distribution Feeder Rules

Still required:

- Define when a lead is distribution-ready
- Define which tags feed current routing system
- Define which existing workflow receives the lead
- Define whether routing is by city, lead type, price/equity, urgency, or round robin
- Define fallback owner when routing fails

## Distribution Feeder Logic

The feeder system should run after intake, dedupe, scoring, and compliance pre-check.

```text
IF lead is duplicate:
    do not feed distribution

IF lead is sensitive and not reviewed:
    send to manual review only

IF lead has no phone/email and requires skip trace:
    send to skip trace workflow first

IF DNC/compliance status is blocked:
    do not send to call/SMS distribution
    optionally route to direct mail only

IF lead is qualified and contactable:
    apply lead-distribution-ready tag
    set assignment fields
    trigger existing lead distribution workflow
```

## Distribution-Ready Criteria

A lead can feed the distribution system only when:

- Contact exists in GHL
- Lead is deduplicated
- Property match is confirmed
- Lead type is known
- Risk level is assigned
- Compliance path is assigned
- Required contact channel exists or skip trace is complete
- Existing seller pipeline/opportunity exists or is ready to create
- Lead priority has been calculated

## Recommended Trigger Tags

Use these new feeder tags:

- api-feed-distribution-ready
- api-feed-sensitive-review
- api-feed-skip-trace-first
- api-feed-dnc-check-first
- api-feed-direct-mail-only
- api-feed-do-not-distribute
- api-feed-routing-error

## Recommended Existing Distribution Hook

The feeder should trigger the existing Agency Lead Router / lead assignment workflow using a tag or field update.

Preferred:

```text
Tag added: api-feed-distribution-ready
```

Alternative:

```text
Field updated: api_intake_status = distribution_ready
```

## Assignment Logic Options

### Option A: Use Existing Round Robin

Best if current lead assignment workflow already works.

Feeder only adds:

- api-feed-distribution-ready
- lead_priority_label
- pipeline_suggestion
- lead_source
- lead_type

### Option B: Source-Based Assignment

Examples:

- foreclosure → senior listing agent
- divorce/probate → manual review specialist
- tax/code violation → ISA or AI assistant first
- high equity → senior agent
- low data quality → nurture pool

### Option C: Geography-Based Assignment

Examples:

- Fort Lauderdale leads → Scott/team route
- Broward County → primary team
- Miami-Dade → Miami team/partner
- Palm Beach → referral or expansion route

### Option D: Urgency-Based Assignment

Examples:

- HOT → immediate task/call owner
- WARM → nurture + task
- COLD → drip/direct mail only

## Recommended Feeder Output To GHL

Contact-level updates:

- lead_source
- lead_type
- lead_priority_label
- lead_intent_score
- seller_score
- seller_equity
- ai_recommendation_message
- last_api_sync_at if field exists

Tags:

- api-feed-distribution-ready or appropriate blocked/review tag
- source tag such as foreclosure, lis-pendens, probate, tax-delinquent
- compliance tag such as needs-dnc-check or manual-review-only

Opportunity:

- Create/update in existing seller pipeline
- Stage determined by compliance and lead quality

Objects:

- Public Record Event
- Property Intelligence
- Compliance Review if required

Cloudflare:

- Store raw payload
- Store duplicate key
- Store distribution event log
- Store routing decision

## Do Not Feed Distribution When

- Record is duplicate with no meaningful status change
- Lead has no verified property match
- Sensitive legal event has not been reviewed
- DNC status is blocked for call/SMS distribution
- Data source terms prohibit CRM marketing use
- Required contact info is missing and skip trace has not been completed
- Lead is enrichment-only, not a new lead

## Final Autonomous Flow

```text
1. Provider sends data to Cloudflare
2. Cloudflare validates webhook secret
3. Cloudflare normalizes data
4. Cloudflare deduplicates
5. Cloudflare stores raw payload in R2
6. Cloudflare creates GHL contact if needed
7. Cloudflare creates GHL Public Record Event object
8. Cloudflare creates/updates GHL Property Intelligence object
9. Cloudflare creates/updates opportunity in existing pipeline
10. Cloudflare applies intake trigger tag
11. GHL runs intake/compliance workflow
12. Feeder evaluates distribution readiness
13. Feeder applies distribution-ready tag
14. Existing lead distribution workflow assigns lead
15. AI/human follow-up begins
```

## Bottom Line

The missing system is not another pipeline. It is a separate Lead Distribution Feeder layer.

The Intake System prepares the lead.
The Feeder System decides if and when it is safe and useful to send the lead into the existing lead distribution workflow.
The existing GHL distribution system remains the assignment engine.
