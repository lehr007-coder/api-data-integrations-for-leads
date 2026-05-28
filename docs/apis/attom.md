# ATTOM Property Data API

## Provider

ATTOM

## Official Documentation

https://api.developer.attomdata.com/docs

## Base URL

```text
https://api.gateway.attomdata.com/propertyapi/v1.0.0
```

## Authentication

Requests require these headers:

```text
Accept: application/json
APIKey: <ATTOM_API_KEY>
```

Store the API key as a Cloudflare Worker secret named `ATTOM_API_KEY`.

## Key Fields

- `property.identifier.attomId`
- `property.address.oneLine`
- `property.owner.owner1.fullName`
- `property.area.countrysecsubd`
- `property.foreclosure.distressType`
- `property.foreclosure.recordingDate`
- `property.foreclosure.documentNumber`
- `property.foreclosure.trusteeSaleNumber`

## Worker Endpoint

```text
POST /providers/attom/property
```

Required header:

```text
x-webhook-secret: <WEBHOOK_SECRET>
```

Example body:

```json
{
  "address": "123 Main St Fort Lauderdale FL 33301",
  "lead_type": "property_enrichment",
  "email": "owner@example.com",
  "phone": "9545551212"
}
```

## Integration Notes

ATTOM property lookup does not guarantee email or phone. When email/phone is present, the Worker syncs the lead to GoHighLevel. When email/phone is missing, the Worker stores the ATTOM match in R2, dedupes it in KV, and returns `202` with `route: "skip_trace"` so a licensed contact append provider can enrich it before GHL sync.

## Foreclosure Feed Monitoring

The Worker also supports ATTOM foreclosure/pre-foreclosure feed polling through:

```text
POST /providers/attom/foreclosures
```

The route accepts pass-through ATTOM search parameters so each market can be tuned without code changes:

```json
{
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
}
```

The scheduled monitor runs hourly. Configure its markets in the Cloudflare Worker variable `ATTOM_FORECLOSURE_SEARCHES` as a JSON array using the same shape as `searches`. The default endpoint is:

```text
https://api.gateway.attomdata.com/propertyapi/v1.0.0/preforeclosuredetails
```

If ATTOM enables a different foreclosure endpoint for the account, set `ATTOM_FORECLOSURE_ENDPOINT` as a Worker variable to override the default.

Feed records are normalized into `foreclosure`, `pre_foreclosure`, or `lis_pendens` leads, deduped through KV, stored in R2, and routed to skip trace when email/phone is missing.

## Admin Import Control

GoHighLevel sync is controlled by:

```text
GET /admin/import-policy
PUT /admin/import-policy
POST /admin/import-policy
```

Default allowed lead types are foreclosure, pre-foreclosure, lis pendens, divorce, probate, tax delinquent, code violation, legal filing, and property enrichment. If a lead type is blocked or dry-run mode is enabled, the Worker stores an `.admin-hold.json` record in R2 and does not import that lead into GoHighLevel.

## CRM Use Risk Level

`MEDIUM_RISK` for property enrichment. `HIGH_RISK` when foreclosure/distress fields are used.

## Recommended Status

- [ ] Research only
- [x] Test integration
- [ ] Production approved
- [ ] Do not use
