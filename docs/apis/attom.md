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

ATTOM property lookup does not guarantee email or phone. GoHighLevel contact upsert requires at least one of `email` or `phone`, so production ATTOM usage should be paired with licensed skip-trace/contact append data before GHL sync when ATTOM does not return a contact identifier.

## CRM Use Risk Level

`MEDIUM_RISK` for property enrichment. `HIGH_RISK` when foreclosure/distress fields are used.

## Recommended Status

- [ ] Research only
- [x] Test integration
- [ ] Production approved
- [ ] Do not use
