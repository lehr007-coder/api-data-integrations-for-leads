# Smarty US Street API

## Provider

Smarty

## Authentication

Smarty server-side requests require both:

```text
SMARTY_AUTH_ID
SMARTY_AUTH_TOKEN
```

The provided numeric value has been stored as `SMARTY_AUTH_ID`. The paired `SMARTY_AUTH_TOKEN` is still required before live address validation will work.

## Worker Endpoints

```text
GET /providers/smarty/status
POST /providers/smarty/us-street
```

The status route reports whether both credentials are configured without exposing their values.

Example validation request:

```json
{
  "street": "1600 Pennsylvania Ave NW",
  "city": "Washington",
  "state": "DC",
  "zipcode": "20500",
  "candidates": 1
}
```

## Current Status

- [x] `SMARTY_AUTH_ID` stored in Cloudflare
- [ ] `SMARTY_AUTH_TOKEN` stored in Cloudflare
- [x] Worker status route added
- [x] Worker US street validation route added
- [ ] Live validation approved
