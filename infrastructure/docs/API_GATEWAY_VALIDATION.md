# API Gateway Request Validation

This document describes the request validation configuration for VaidyaLink's API Gateway, implementing **Task 6.1** from the implementation plan.

## Overview

API Gateway request validation ensures that incoming requests meet the expected format before reaching Lambda functions, reducing unnecessary Lambda invocations and improving security. This implementation satisfies **Requirement 6** (Security and Privacy) by validating all API inputs.

## Request Validators

Three request validators are configured:

### 1. Body and Parameters Validator

- **Name**: `body-and-params-validator`
- **Validates**: Request body AND path/query parameters
- **Use Case**: Endpoints that require both body content and URL parameters (e.g., `POST /voice/{jobId}/confirm`)

### 2. Body-Only Validator

- **Name**: `body-only-validator`
- **Validates**: Request body only
- **Use Case**: POST/PUT endpoints without path parameters (e.g., `POST /scans`, `POST /abdm/link`)

### 3. Parameters-Only Validator

- **Name**: `params-only-validator`
- **Validates**: Path and query parameters only
- **Use Case**: GET endpoints (e.g., `GET /scans/{jobId}`, `GET /patients/{id}/records`)

## Request Models

### Scan Job Models

#### CreateScanRequest

```json
{
  "patientId": "string (1-100 chars, required)",
  "imageS3Key": "string (1-500 chars, required)",
  "metadata": {
    "documentType": "string (optional)",
    "captureDate": "ISO 8601 datetime (optional)",
    "notes": "string (max 1000 chars, optional)"
  }
}
```

**Validation Rules**:

- `patientId`: Required, 1-100 characters
- `imageS3Key`: Required, 1-500 characters
- `metadata.notes`: Maximum 1000 characters

### Voice Job Models

#### CreateVoiceRequest

```json
{
  "patientId": "string (required)",
  "audioS3Key": "string (required)",
  "language": "string (required, enum)"
}
```

**Validation Rules**:

- `language`: Must be one of 22 Indian languages: `hi`, `en`, `bn`, `te`, `mr`, `ta`, `gu`, `kn`, `ml`, `pa`, `or`, `as`, `ur`, `sa`, `ks`, `sd`, `ne`, `kok`, `mni`, `doi`, `mai`, `sat`

#### ConfirmVoiceRequest

```json
{
  "confirmed": "boolean (required)",
  "correctedTranscription": "string (max 5000 chars, optional)"
}
```

### ABDM Models

#### LinkABHARequest

```json
{
  "abhaId": "string (required, pattern: XX-XXXX-XXXX-XXXX)",
  "otp": "string (required, pattern: XXXXXX)"
}
```

**Validation Rules**:

- `abhaId`: Must match pattern `^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$`
- `otp`: Must match pattern `^[0-9]{6}$` (6-digit OTP)

#### ConsentRequest

```json
{
  "purpose": "string (required, enum)",
  "hiTypes": ["string (required, array, min 1 item)"],
  "dateRange": {
    "from": "ISO 8601 datetime (required)",
    "to": "ISO 8601 datetime (required)"
  }
}
```

**Validation Rules**:

- `purpose`: Must be one of: `CAREMGT`, `BTG`, `PUBHLTH`, `HPAYMT`, `DSRCH`, `PATRQT`
- `hiTypes`: Array with at least 1 item from: `Prescription`, `DiagnosticReport`, `OPConsultation`, `DischargeSummary`, `ImmunizationRecord`, `HealthDocumentRecord`, `WellnessRecord`

### HITL Models

#### VerifyHITLRequest

```json
{
  "correctedData": {
    "patientName": "string (max 200 chars, optional)",
    "medications": [
      {
        "name": "string",
        "dosage": "string",
        "frequency": "string"
      }
    ],
    "diagnoses": ["string"]
  },
  "notes": "string (max 2000 chars, optional)"
}
```

### Error Response Model

All error responses follow this structure:

```json
{
  "message": "string",
  "code": "string",
  "requestId": "string"
}
```

## Endpoint Validation Configuration

### Scan Endpoints

| Endpoint                     | Method | Validator   | Request Model     | Path Params        | Query Params |
| ---------------------------- | ------ | ----------- | ----------------- | ------------------ | ------------ |
| `/api/v1/scans`              | POST   | Body-only   | CreateScanRequest | -                  | -            |
| `/api/v1/scans/{jobId}`      | GET    | Params-only | -                 | `jobId` (required) | -            |
| `/api/v1/scans/{jobId}/data` | GET    | Params-only | -                 | `jobId` (required) | -            |

### Voice Endpoints

| Endpoint                        | Method | Validator   | Request Model       | Path Params        | Query Params |
| ------------------------------- | ------ | ----------- | ------------------- | ------------------ | ------------ |
| `/api/v1/voice`                 | POST   | Body-only   | CreateVoiceRequest  | -                  | -            |
| `/api/v1/voice/{jobId}/confirm` | POST   | Body+Params | ConfirmVoiceRequest | `jobId` (required) | -            |

### Patient Endpoints

| Endpoint                        | Method | Validator   | Request Model | Path Params     | Query Params                                      |
| ------------------------------- | ------ | ----------- | ------------- | --------------- | ------------------------------------------------- |
| `/api/v1/patients/{id}/records` | GET    | Params-only | -             | `id` (required) | `startDate`, `endDate`, `resourceType` (optional) |
| `/api/v1/patients/{id}/summary` | GET    | Params-only | -             | `id` (required) | -                                                 |
| `/api/v1/patients/{id}/export`  | GET    | Params-only | -             | `id` (required) | `format` (optional)                               |

### ABDM Endpoints

| Endpoint               | Method | Validator   | Request Model   | Path Params | Query Params                                |
| ---------------------- | ------ | ----------- | --------------- | ----------- | ------------------------------------------- |
| `/api/v1/abdm/link`    | POST   | Body-only   | LinkABHARequest | -           | -                                           |
| `/api/v1/abdm/records` | GET    | Params-only | -               | -           | `abhaId` (required), `consentId` (optional) |
| `/api/v1/abdm/consent` | POST   | Body-only   | ConsentRequest  | -           | -                                           |

### HITL Endpoints

| Endpoint                      | Method | Validator   | Request Model     | Path Params        | Query Params                 |
| ----------------------------- | ------ | ----------- | ----------------- | ------------------ | ---------------------------- |
| `/api/v1/hitl/queue`          | GET    | Params-only | -                 | -                  | `status`, `limit` (optional) |
| `/api/v1/hitl/{jobId}/verify` | POST   | Body+Params | VerifyHITLRequest | `jobId` (required) | -                            |

## Method Responses

All endpoints define standard HTTP response codes with appropriate models:

### Success Responses

- **200 OK**: Successful GET requests
- **201 Created**: Successful POST requests creating resources

### Error Responses

- **400 Bad Request**: Validation errors, malformed requests
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors

## Validation Error Examples

### Invalid ABHA ID Format

```json
{
  "message": "Invalid request body",
  "code": "ValidationException",
  "requestId": "abc-123-def"
}
```

**Cause**: ABHA ID doesn't match pattern `XX-XXXX-XXXX-XXXX`

### Missing Required Field

```json
{
  "message": "Missing required request parameters: [patientId]",
  "code": "ValidationException",
  "requestId": "abc-123-def"
}
```

**Cause**: Required field `patientId` not provided in request body

### Invalid Language Code

```json
{
  "message": "Invalid value for language. Must be one of: hi, en, bn, te, mr, ta, gu, kn, ml, pa, or, as, ur, sa, ks, sd, ne, kok, mni, doi, mai, sat",
  "code": "ValidationException",
  "requestId": "abc-123-def"
}
```

**Cause**: Language code not in the supported list

## Testing

Run the validation tests:

```bash
cd infrastructure
npm test -- api-gateway-validation.test.ts
```

## Benefits

1. **Reduced Lambda Invocations**: Invalid requests are rejected at API Gateway, saving Lambda costs
2. **Improved Security**: Input validation prevents malformed data from reaching application code
3. **Better Error Messages**: Clients receive immediate feedback on validation errors
4. **Consistent API Contract**: Request models serve as API documentation
5. **HIPAA Compliance**: Input validation is a technical safeguard requirement

## Integration with Other Components

- **Cognito Authorizer**: All endpoints require valid JWT tokens (Task 4.3)
- **Rate Limiting**: Usage plans enforce request limits (Task 6.2)
- **CloudWatch Logging**: Validation errors are logged for monitoring (Task 28.1)
- **X-Ray Tracing**: Validation failures are traced for debugging (Task 29.1)

## Next Steps

- **Task 6.2**: Implement rate limiting per user tier
- **Task 6.3**: Configure CORS policies
- **Task 6.4**: Add API key management for external integrations
- **Task 13.7**: Add request/response validation schemas for remaining endpoints
- **Task 13.8**: Create OpenAPI specification from models

## References

- [AWS API Gateway Request Validation](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-request-validation.html)
- [JSON Schema Specification](https://json-schema.org/)
- [ABDM API Specifications](https://sandbox.abdm.gov.in/docs)
- VaidyaLink Requirements Document: Requirement 6 (Security and Privacy)
