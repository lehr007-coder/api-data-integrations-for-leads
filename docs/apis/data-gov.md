# data.gov API Key

## Provider

api.data.gov

## Authentication

Store the key as a Cloudflare Worker secret named:

```text
DATA_GOV_API_KEY
```

This key is a gateway credential for U.S. agency APIs that use api.data.gov authentication. The exact endpoint and query shape depend on the agency API being called.

## Worker Endpoint

```text
GET /providers/data-gov/status
POST /providers/data-gov/request
```

The status route reports whether the key is configured without exposing the key value.

The request route is authenticated with `x-webhook-secret`, accepts an allowed api.data.gov agency URL, appends the API key server-side, and stores the response in R2 by default.

## Current Status

- [x] Secret stored in Cloudflare
- [x] Worker status route added
- [x] Safe request gateway added
- [ ] Agency-specific integration selected
- [ ] Production approved
