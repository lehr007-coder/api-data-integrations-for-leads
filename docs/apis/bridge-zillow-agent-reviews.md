# Bridge Data Output Zillow Agent Reviews

## Provider

Bridge Data Output / Zillow Agent Reviews

## Authentication

Store the Bridge access token as a Cloudflare Worker secret named:

```text
BRIDGE_ACCESS_TOKEN
```

Bridge documentation states that Zillow Agent Reviews access requires approval and uses the Reviewees and Reviews resources.

## Worker Endpoints

```text
GET /providers/bridge/zillow-agent-reviews/status
POST /providers/bridge/zillow-agent-reviews/reviewees
POST /providers/bridge/zillow-agent-reviews/reviews
POST /providers/bridge/zillow-agent-reviews/sync-ghl
```

Example reviewee lookup:

```json
{
  "revieweeEmail": "agent@example.com",
  "top": 10
}
```

Example reviews lookup:

```json
{
  "revieweeKey": "REVIEWEE_KEY",
  "top": 25
}
```

Responses are stored in R2 under `bridge-zillow-reviews/` by default. Set `"store": false` for a non-persistent probe.

Example CRM sync:

```json
{
  "revieweeEmail": "agent@example.com",
  "revieweeName": "Agent Name",
  "phone": "9545551212",
  "top": 25
}
```

The CRM sync route fetches Bridge reviewee/review data, stores the raw payload in R2, and upserts a GoHighLevel contact tagged with `bridge-data-output`, `zillow-agent-reviews`, and `crm-social-proof`.

## Display Compliance

Zillow review data is treated as CRM social-proof/profile data, not a foreclosure/legal lead source.

Follow Zillow/Bridge display rules for review count, rating, review text, branding, and links when showing this data publicly.

## Current Status

- [ ] `BRIDGE_ACCESS_TOKEN` stored in Cloudflare
- [x] Worker status route added
- [x] Reviewees fetch route added
- [x] Reviews fetch route added
- [x] GoHighLevel sync route added
- [ ] Live provider access verified
