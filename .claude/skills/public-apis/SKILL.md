# Skill: public-apis

## Purpose

Use this skill when discovering, evaluating, documenting, or integrating public APIs into the API Data Integrations for Leads project.

This project focuses on real estate lead generation and CRM automation using public, open, free, freemium, or licensed APIs where legally permitted.

Primary use cases include:

- Public records research
- Real estate lead enrichment
- County, city, state, and federal datasets
- Property, zoning, code violation, permitting, foreclosure, court, and owner-data sources
- School, crime, census, demographic, flood, climate, and location-data APIs
- API feeds that can be routed into Cloudflare Workers and GoHighLevel

## Core Rule

Do not assume an API is usable just because data is public. Always verify:

1. Official source
2. Terms of use
3. API authentication requirements
4. Rate limits
5. Commercial-use restrictions
6. Data freshness
7. Whether redistribution or CRM marketing use is allowed
8. Whether personally identifiable information is involved

## Preferred API Types

Prioritize APIs in this order:

1. Official government APIs
2. County or municipal open-data portals
3. State open-data portals
4. Federal datasets
5. University or nonprofit public datasets
6. Commercial APIs with documented terms
7. Community-maintained API indexes only as discovery sources, not final authority

## Public API Evaluation Checklist

For every API, document:

- API name
- Provider / owner
- Official documentation URL
- Base URL
- Authentication method
- Free tier availability
- Rate limits
- Data coverage
- Data update frequency
- Commercial-use permission
- PII sensitivity
- CRM-use risk level
- Example request
- Example response fields
- Integration recommendation
- Whether it should be used for production, research, or testing only

## Risk Levels

Use these labels:

- `LOW_RISK`: Public non-PII data, official API, clear commercial terms
- `MEDIUM_RISK`: Public records or location data with some use restrictions
- `HIGH_RISK`: Court, foreclosure, divorce, personal, financial, or sensitive life-event data
- `DO_NOT_USE`: Prohibited, unclear licensing, scraped against terms, or unsafe for CRM marketing

## Real Estate API Categories

When researching APIs for this project, organize them into these groups:

### Property and Land Records

Examples:

- County property appraiser data
- Parcel data
- Tax assessment data
- Building permits
- Zoning records
- GIS APIs

### Court and Legal Event Data

Examples:

- Lis Pendens
- Foreclosure filings
- Probate
- Divorce / dissolution of marriage
- Eviction filings
- Civil judgments

Special rule: treat these as HIGH_RISK unless terms clearly allow CRM marketing use.

### Environmental and Location Data

Examples:

- FEMA flood maps
- NOAA weather and storm data
- EPA environmental data
- USGS maps
- Census geographies

### Community and Lifestyle Data

Examples:

- School district data
- Walkability or transit data
- Crime data where legally available
- Demographics
- Local amenities

### Marketing and Enrichment Data

Examples:

- Address validation
- Geocoding
- Phone/email append vendors
- DNC screening providers
- Direct mail APIs

## Cloudflare Integration Pattern

Preferred architecture:

```text
Public API / Data Provider
        ↓
Cloudflare Worker Cron or Webhook
        ↓
API Fetch + Rate Limit Guard
        ↓
Normalize Response
        ↓
Risk + Compliance Filter
        ↓
Deduplication via KV / Durable Object
        ↓
Queue Processing
        ↓
GoHighLevel API
        ↓
Tags / Custom Fields / Workflows / AI Agent
```

## GoHighLevel Integration Rules

Before pushing public API data into GHL:

1. Confirm legal basis for using the data.
2. Deduplicate records.
3. Add the source provider field.
4. Add the data freshness date.
5. Add compliance status.
6. Tag high-risk sources for manual review.
7. Do not automatically call or text sensitive leads unless TCPA/DNC compliance has been checked.

Recommended GHL tags:

- `api-source-public`
- `api-source-government`
- `api-source-commercial`
- `api-risk-low`
- `api-risk-medium`
- `api-risk-high`
- `needs-compliance-review`
- `needs-dnc-check`
- `needs-skip-trace`

## Required Documentation Format

When adding a new API, create a markdown file under:

```text
docs/apis/{api-slug}.md
```

Use this template:

```markdown
# API Name

## Provider

## Official Documentation

## Base URL

## Authentication

## Free Tier / Cost

## Rate Limits

## Data Coverage

## Update Frequency

## Key Fields

## Example Request

## Example Response Summary

## Commercial Use / Terms

## CRM Use Risk Level

## Integration Notes

## Recommended Status

- [ ] Research only
- [ ] Test integration
- [ ] Production approved
- [ ] Do not use
```

## Never Do This

- Never scrape a site if the terms prohibit automation.
- Never bypass paywalls, captchas, or access controls.
- Never commit API keys or tokens.
- Never store sensitive personal records unless permitted.
- Never imply public record data is automatically safe for marketing.
- Never create deceptive outreach based on distress-event data.

## Claude Code Instruction

When Claude Code works on public API integrations:

- Create one provider module per API.
- Use environment variables for keys.
- Add rate-limit handling.
- Add retry logic only where permitted.
- Add schema validation for external responses.
- Add synthetic sample payloads only.
- Add docs before production wiring.
- Default sensitive court-data APIs to manual review.

## Success Criteria

A public API integration is acceptable only when:

- The API source is verified.
- Terms are documented.
- The integration path is clear.
- Secrets are not committed.
- Data is normalized.
- Risk level is assigned.
- GHL field/tag mapping is documented.
- Compliance caveats are visible.
