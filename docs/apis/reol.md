# REOL API

## Provider

REOL

## Authentication

Store the key as a Cloudflare Worker secret named:

```text
REOL_API_KEY
```

## Worker Endpoint

```text
GET /providers/reol/status
```

The status route reports whether the key is configured without exposing the key value.

## Current Status

- [x] Secret stored in Cloudflare
- [x] Worker status route added
- [ ] Provider documentation confirmed
- [ ] Production fetch endpoint enabled
