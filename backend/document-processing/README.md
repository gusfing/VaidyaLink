# Document Processing Lambda

OCR extraction and clinical data structuring using PaddleOCR and Amazon Bedrock.

## Runtime

Python 3.11

## Responsibilities

- Receive S3 event notifications for uploaded medical documents
- Extract text using PaddleOCR
- Structure clinical data using Amazon Bedrock (Claude 3.5 Sonnet)
- Calculate confidence scores for extracted fields
- Route low-confidence extractions to HITL queue
- Trigger FHIR transformation

## Environment Variables

- `BEDROCK_MODEL_ID` - Claude 3.5 Sonnet model identifier
- `CONFIDENCE_THRESHOLD` - Minimum confidence for auto-processing (default: 0.80)
- `S3_BUCKET` - Source bucket for images
- `HITL_QUEUE_URL` - SQS queue for HITL jobs
- `FHIR_LAMBDA_ARN` - ARN of FHIR transformation Lambda

## Dependencies

See `requirements.txt`
