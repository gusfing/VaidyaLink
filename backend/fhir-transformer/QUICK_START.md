# FHIR Transformer Lambda - Quick Start

## Overview

The FHIR Transformer Lambda converts structured clinical data extracted from medical documents into HL7 FHIR R4 resources and stores them in AWS HealthLake.

## Prerequisites

- Python 3.11
- AWS account with HealthLake configured
- Required environment variables set

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:

- `HEALTHLAKE_DATASTORE_ID` - Your HealthLake datastore ID
- `AWS_ACCOUNT_ID` - Your AWS account ID
- `AWS_REGION` - AWS region (default: ap-south-1)

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
python -m pytest src/__tests__/test_handler.py -v
```

## Lambda Event Structure

### Transform Operation

```json
{
  "operation": "transform",
  "patientId": "patient-123",
  "jobId": "job-456",
  "data": {
    "patientData": {
      "name": "Rajesh Kumar",
      "gender": "male",
      "birthDate": "1985-06-15"
    },
    "medications": [
      {
        "name": "Omeprazole",
        "dosage": "20mg",
        "frequency": "once daily"
      }
    ],
    "observations": [],
    "encounters": [],
    "diagnosticReports": []
  },
  "options": {
    "validateOnly": false,
    "pushToABDM": false
  }
}
```

### Export Operation

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json"
  }
}
```

### Validate Operation

```json
{
  "operation": "validate",
  "data": {
    "patientData": {...},
    "medications": [...]
  }
}
```

## Response Format

### Success Response

```json
{
  "statusCode": 200,
  "body": {
    "message": "FHIR transformation initiated",
    "patientId": "patient-123",
    "jobId": "job-456",
    "resourceIds": [],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "body": {
    "error": "FHIRTransformerError",
    "message": "patientId is required"
  }
}
```

## Development

### Code Formatting

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

## Project Structure

```
backend/fhir-transformer/
├── src/
│   ├── __init__.py
│   ├── index.py              # Main Lambda handler
│   ├── config.py             # Configuration management
│   ├── utils/
│   │   ├── __init__.py
│   │   └── logger.py         # Logging utilities
│   └── __tests__/
│       ├── __init__.py
│       └── test_handler.py   # Handler tests
├── .env.example
├── Dockerfile.dev
├── package.json
├── pytest.ini
├── requirements.txt
└── README.md
```

## Next Steps

The following tasks will implement the core FHIR transformation functionality:

- **Task 9.2**: Integrate FHIR-Parser library
- **Task 9.3**: Implement Patient resource creation
- **Task 9.4**: Implement MedicationStatement resource creation
- **Task 9.5**: Implement Observation resource creation
- **Task 9.6**: Implement Encounter resource creation
- **Task 9.7**: Implement DiagnosticReport resource creation
- **Task 9.8**: Add code system mapping (ICD-10, SNOMED, LOINC)
- **Task 9.9**: Implement FHIR validation against profiles
- **Task 9.10**: Create HealthLake integration
- **Task 9.11**: Add FHIR bundle generation for export

## Troubleshooting

### Import Errors

If you encounter import errors, ensure you're running from the correct directory:

```bash
cd backend/fhir-transformer
python -m pytest
```

### AWS Credentials

Ensure AWS credentials are configured:

```bash
aws configure
```

### HealthLake Access

Verify HealthLake datastore exists:

```bash
aws healthlake describe-fhir-datastore --datastore-id YOUR_DATASTORE_ID
```

## Support

For issues or questions, refer to the main README.md or contact the VaidyaLink team.
