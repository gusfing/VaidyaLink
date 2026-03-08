# HITL Handler Lambda

Human-in-the-loop verification workflow management.

## Runtime

Node.js 18

## Responsibilities

- Manage verification queue for low-confidence extractions
- Route jobs to human verifiers
- Process verification results
- Update DynamoDB with corrected data
- Trigger FHIR transformation after verification

## Environment Variables

- `HITL_QUEUE_URL` - SQS queue for HITL jobs
- `DYNAMODB_TABLE` - DynamoDB table for scan jobs
- `FHIR_LAMBDA_ARN` - ARN of FHIR transformation Lambda

## Dependencies

See `package.json`
