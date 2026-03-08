# API Handler Lambda

Backend API Lambda function for the document-scan-demo application. Handles presigned URL generation, job management, and authentication.

## Overview

This Lambda function provides a REST API for:

- Generating presigned URLs for S3 uploads (documents and audio)
- Creating and managing processing jobs
- Querying job status and results
- Updating voice transcription corrections

## Architecture

- **Runtime**: Node.js 20.x
- **Framework**: Express.js with serverless-http adapter
- **Authentication**: AWS Cognito JWT verification
- **Validation**: Joi schemas
- **Rate Limiting**: Token bucket algorithm with DynamoDB

## Endpoints

### Health Check

- `GET /health` - Health check endpoint (no auth required)

### Presigned URLs

- `POST /upload/presigned-url` - Generate presigned URL for document upload
  - Request: `{ filename: string }`
  - Response: `{ uploadUrl: string, s3Key: string, expiresIn: number }`
  - Validates: JPEG, PNG, PDF formats

- `POST /upload/audio-presigned-url` - Generate presigned URL for audio upload
  - Request: `{ filename: string }`
  - Response: `{ uploadUrl: string, s3Key: string, expiresIn: number }`
  - Validates: WAV format

### Job Management

- `POST /jobs/process` - Create document processing job
  - Request: `{ s3Key: string }`
  - Response: `{ jobId: string }`

- `POST /jobs/transcribe` - Create voice transcription job
  - Request: `{ s3Key: string, language: string }`
  - Response: `{ jobId: string }`
  - Supported languages: hi, en, ta, te, kn, ml, bn, mr, gu

- `GET /jobs/:jobId/status` - Get job status
  - Response: `{ jobId: string, status: string, type: string, message?: string, error?: string }`

- `GET /jobs/:jobId/results` - Get job results (only when status is 'complete')
  - Response: Complete processing results (varies by job type)

- `PATCH /jobs/:jobId/transcription` - Update transcription with corrections
  - Request: `{ correctedText: string }`
  - Response: `{ success: boolean }`

## Authentication

All endpoints (except `/health`) require authentication via AWS Cognito JWT token:

```
Authorization: Bearer <jwt-token>
```

The middleware extracts user identity from token claims:

- `userId` (from `sub` claim)
- `email`
- `username` (from `cognito:username`)
- `groups` (from `cognito:groups`)

## Rate Limiting

- **Limit**: 100 requests per minute per user
- **Storage**: DynamoDB
- **Response**: 429 status code when exceeded
- **Headers**:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After` (when rate limited)

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": "Additional error details",
  "requestId": "unique-request-id"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication errors)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Environment Variables

Required:

- `AWS_REGION` - AWS region (e.g., us-east-1)
- `COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `S3_DOCUMENTS_BUCKET` - S3 bucket for documents
- `S3_AUDIO_BUCKET` - S3 bucket for audio files
- `JOBS_TABLE` - DynamoDB table for job tracking
- `RATE_LIMIT_TABLE` - DynamoDB table for rate limiting

Optional:

- `NODE_ENV` - Environment (development/production)

## Development

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Local Testing

The Lambda can be tested locally using AWS SAM or the Serverless Framework.

## Deployment

This Lambda is deployed as part of the VaidyaLink infrastructure using AWS CDK. See the infrastructure documentation for deployment instructions.

## Dependencies

- `express` - Web framework
- `serverless-http` - Express to Lambda adapter
- `joi` - Request validation
- `jsonwebtoken` - JWT verification
- `jwks-rsa` - Cognito public key retrieval
- `@aws-sdk/client-s3` - S3 operations
- `@aws-sdk/s3-request-presigner` - Presigned URL generation
- `@aws-sdk/client-dynamodb` - DynamoDB operations
- `uuid` - Request ID generation

## Related Documentation

- [Requirements Document](../../.kiro/specs/aws-real-data-integration/requirements.md)
- [Design Document](../../.kiro/specs/aws-real-data-integration/design.md)
- [Rate Limiting Guide](../shared/nodejs/middleware/RATE_LIMITING.md)
