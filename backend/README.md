# VaidyaLink Backend Services

This directory contains all AWS Lambda functions for the VaidyaLink platform.

## Structure

```
backend/
├── document-processing/    # Document OCR and extraction Lambda (Python)
├── voice-processing/        # Voice transcription Lambda (Node.js)
├── clinical-summarizer/     # Clinical summary generation Lambda (Python)
├── fhir-transformer/        # FHIR resource transformation Lambda (Python)
├── abdm-connector/          # ABDM integration Lambda (Node.js)
├── hitl-handler/            # Human-in-the-loop verification Lambda (Node.js)
└── shared/                  # Shared utilities and libraries
```

## Lambda Functions

### Document Processing Lambda

- **Runtime**: Python 3.11
- **Purpose**: OCR extraction and clinical data structuring
- **Key Dependencies**: PaddleOCR, boto3, Amazon Bedrock SDK

### Voice Processing Lambda

- **Runtime**: Node.js 18
- **Purpose**: Voice transcription via Bhashini API
- **Key Dependencies**: axios, aws-sdk

### Clinical Summarizer Lambda

- **Runtime**: Python 3.11
- **Purpose**: Generate 30-second clinical summaries
- **Key Dependencies**: boto3, Amazon Bedrock SDK

### FHIR Transformer Lambda

- **Runtime**: Python 3.11
- **Purpose**: Convert structured data to HL7 FHIR R4
- **Key Dependencies**: fhir-parser, boto3

### ABDM Connector Lambda

- **Runtime**: Node.js 18
- **Purpose**: ABDM integration and consent management
- **Key Dependencies**: abdm-sdk, aws-sdk

### HITL Handler Lambda

- **Runtime**: Node.js 18
- **Purpose**: Human verification workflow management
- **Key Dependencies**: aws-sdk

## Development

Each Lambda function has its own directory with:

- `src/` - Source code
- `tests/` - Unit tests
- `package.json` or `requirements.txt` - Dependencies
- `README.md` - Function-specific documentation

## Deployment

Lambda functions are deployed via AWS CDK (see `infrastructure/` directory).
