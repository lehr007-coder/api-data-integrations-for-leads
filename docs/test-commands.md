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
