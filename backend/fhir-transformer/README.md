# FHIR Transformer Lambda

Convert structured clinical data to HL7 FHIR R4 resources.

## Runtime

Python 3.11

## Responsibilities

- Convert structured clinical data to FHIR R4 resources
- Map Indian medical codes to international standards (ICD-10, SNOMED CT, LOINC)
- Validate FHIR resources against profiles
- Store resources in AWS HealthLake
- Generate FHIR bundles for export

## Environment Variables

- `HEALTHLAKE_DATASTORE_ID` - AWS HealthLake datastore identifier
- `HEALTHLAKE_ENDPOINT` - HealthLake API endpoint

## Dependencies

See `requirements.txt`
