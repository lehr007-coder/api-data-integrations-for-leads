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

## CRM Use Risk Level

`MEDIUM_RISK` for property enrichment. `HIGH_RISK` when foreclosure/distress fields are used.

## Recommended Status

- [ ] Research only
- [x] Test integration
- [ ] Production approved
- [ ] Do not use
