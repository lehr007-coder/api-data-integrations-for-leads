# Test Commands

## Health Check

Replace the Worker URL after deployment.

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/health"
```

## Public Record Intake Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/intake/test" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary @test-payloads/foreclosure.json
```

## Lis Pendens Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/intake/public-record" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary @test-payloads/lis-pendens.json
```

## Probate Sensitive Lead Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/intake/public-record" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary @test-payloads/probate.json
```

## Divorce Sensitive Lead Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/intake/public-record" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary @test-payloads/divorce.json
```

## Tax Delinquent Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/intake/public-record" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary @test-payloads/tax-delinquent.json
```

## ATTOM Property Lookup Test

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/attom/property" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "address": "123 Main St Fort Lauderdale FL 33301",
    "lead_type": "property_enrichment",
    "email": "owner@example.com",
    "phone": "9545551212"
  }'
```

## ATTOM Property Lookup Without Contact Info

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/attom/property" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "address": "4529 Winona Court, Denver, CO",
    "lead_type": "property_enrichment"
  }'
```

Expected result: `202 Accepted` with `pending: true` and `route: "skip_trace"`.

## ATTOM Batch Lookup

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/attom/batch" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "items": [
      {
        "address": "4529 Winona Court, Denver, CO",
        "lead_type": "property_enrichment",
        "email": "owner1@example.com",
        "phone": "9545551212"
      },
      {
        "address": "1600 Pennsylvania Ave NW Washington DC",
        "lead_type": "property_enrichment"
      }
    ]
  }'
```

Batch limit: 25 items.

## ATTOM Foreclosure Feed Poll

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/attom/foreclosures" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "searches": [
      {
        "name": "broward-foreclosures",
        "limit": 25,
        "params": {
          "state": "FL",
          "county": "Broward"
        }
      }
    ]
  }'
```

The hourly Cloudflare scheduled trigger uses `ATTOM_FORECLOSURE_SEARCHES` with the same `searches` array shape.

## Admin Import Policy

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/admin/import-policy" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET"
```

Pause one category from syncing into GoHighLevel:

```bash
curl -X PUT "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/admin/import-policy" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "blockedLeadTypes": ["divorce"],
    "allowedLeadTypes": [
      "foreclosure",
      "pre_foreclosure",
      "lis_pendens",
      "divorce",
      "probate",
      "tax_delinquent",
      "code_violation",
      "legal_filing",
      "property_enrichment"
    ]
  }'
```

Reset to defaults:

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/admin/import-policy" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET"
```

Release a held record into GoHighLevel:

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/admin/release" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "cloudflareRecordRef": "CLOUDFLARE_RECORD_REF",
    "tags": ["admin-reviewed"]
  }'
```

## data.gov Status

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/data-gov/status"
```

## data.gov Request

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/data-gov/request" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "url": "https://api.data.gov/example/agency/path",
    "method": "GET",
    "store": true
  }'
```

The Worker appends `DATA_GOV_API_KEY` server-side and stores the response in R2 by default.

## REOL Status

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/reol/status"
```

## Smarty Status

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/smarty/status"
```

## Smarty US Street Validation

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/smarty/us-street" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "street": "1600 Pennsylvania Ave NW",
    "city": "Washington",
    "state": "DC",
    "zipcode": "20500",
    "candidates": 1
  }'
```

## Bridge Zillow Agent Reviews Status

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/bridge/zillow-agent-reviews/status"
```

## Bridge Zillow Agent Reviewees

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/bridge/zillow-agent-reviews/reviewees" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "revieweeEmail": "agent@example.com",
    "top": 10
  }'
```

## Bridge Zillow Agent Reviews

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/bridge/zillow-agent-reviews/reviews" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "revieweeKey": "REVIEWEE_KEY",
    "top": 25
  }'
```

## Bridge Zillow Agent Reviews to GHL

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/providers/bridge/zillow-agent-reviews/sync-ghl" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "revieweeEmail": "agent@example.com",
    "revieweeName": "Agent Name",
    "phone": "9545551212",
    "top": 25
  }'
```

## Complete Pending Skip Trace

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/pending/skip-trace/complete" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "cloudflareRecordRef": "CLOUDFLARE_RECORD_REF_FROM_PENDING_RESPONSE",
    "email": "owner@example.com",
    "phone": "9545551212",
    "tags": ["skip-trace-provider-manual"]
  }'
```

## Complete DNC Check

```bash
curl -X POST "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/pending/dnc/complete" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  --data-binary '{
    "cloudflareRecordRef": "CLOUDFLARE_RECORD_REF_FROM_PENDING_RESPONSE",
    "dnc_status": "clear",
    "provider": "manual",
    "result_id": "manual-clear-001",
    "tags": ["dnc-provider-manual"]
  }'
```

When `dnc_status` is `clear`, the Worker updates the GHL contact, adds `api-feed-distribution-ready`, then creates one GHL note and one open follow-up task. The note/task creation is idempotent per `cloudflareRecordRef`.

## Inspect Record Status

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/records/status?cloudflareRecordRef=CLOUDFLARE_RECORD_REF" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET"
```

## List Stored Records

```bash
curl -X GET "https://api-data-integrations-for-leads.YOUR_SUBDOMAIN.workers.dev/records/list?limit=25" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET"
```

## Expected Result

The response should include:

- `ok: true`
- `cloudflareRecordRef`
- `dedupeKey`
- `compliance`
- `feeder`
- `lead`

If the same payload is submitted twice, the second request should return:

```json
{
  "ok": true,
  "duplicate": true,
  "message": "Duplicate lead blocked before GHL creation."
}
```
