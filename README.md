# API Data Integrations for Leads

Cloudflare Workers + GoHighLevel public API integration for real estate public-record lead ingestion.

## Lead Sources Supported

- Lis Pendens
- Foreclosure / Pre-Foreclosure
- Divorce / Dissolution of Marriage
- Future: Probate, Code Violations, Tax Delinquency, Absentee Owner, Eviction, FSBO, Expired Listings

## Core Architecture

```text
External Data Provider / Court Data Export
        ↓
Cloudflare Worker Webhook Endpoint
        ↓
Signature + Payload Validation
        ↓
Normalize Lead Record
        ↓
Deduplicate by Source + Case Number + Property Address
        ↓
Push Create/Update Contact to GoHighLevel
        ↓
Apply Tags + Custom Fields
        ↓
Trigger GHL Workflows / AI Agent / Pipeline Automation
```

## Cloudflare Components

- Workers: API endpoint and processing engine
- KV: Deduplication and lightweight state
- Queues: Async processing and retry handling
- R2: Raw payload archive
- Cron Triggers: Scheduled provider polling
- Durable Objects: Optional locking / per-county sync state

## GHL Components

- Public API / OAuth-ready structure
- Contacts API
- Tags
- Custom Fields
- Workflows
- Opportunities / Pipelines
- Custom Objects for advanced event history
- AI Agent follow-up workflows

## Required Environment Variables

```bash
GHL_BASE_URL=https://services.leadconnectorhq.com
GHL_LOCATION_ID=
GHL_API_TOKEN=
WEBHOOK_SECRET=
```

## Local Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Compliance Warning

This system must only use lawful data sources and licensed vendor data. Outreach must comply with TCPA, DNC, CAN-SPAM, Florida public records restrictions, and all data-provider licensing terms.
