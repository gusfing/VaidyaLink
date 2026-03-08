# ABDM Connector Lambda

Integration with Ayushman Bharat Digital Mission (ABDM) services.

## Runtime

Node.js 18

## Responsibilities

- Authenticate users via ABHA ID
- Fetch health records from ABDM Health Information Exchange
- Push FHIR resources to ABDM with user consent
- Manage consent artifacts per ABDM specifications
- Verify healthcare facilities via Health Facility Registry

## Environment Variables

- `ABDM_CLIENT_ID` - ABDM API client ID
- `ABDM_CLIENT_SECRET` - ABDM API client secret
- `ABDM_BASE_URL` - ABDM API base URL
- `HEALTHLAKE_DATASTORE_ID` - AWS HealthLake datastore identifier

## Dependencies

See `package.json`
