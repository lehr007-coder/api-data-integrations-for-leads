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

## Display Compliance

Zillow review data is not treated as a lead source by default. It should be used for agent/profile/social proof workflows unless a separate approved mapping is added.

Follow Zillow/Bridge display rules for review count, rating, review text, branding, and links when showing this data publicly.

## Current Status

- [ ] `BRIDGE_ACCESS_TOKEN` stored in Cloudflare
- [x] Worker status route added
- [x] Reviewees fetch route added
- [x] Reviews fetch route added
- [ ] Live provider access verified
