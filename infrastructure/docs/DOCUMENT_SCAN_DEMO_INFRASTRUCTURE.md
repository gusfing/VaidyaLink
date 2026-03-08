# Document Scan Demo Infrastructure

This document describes the AWS infrastructure setup for the document-scan-demo application's real data integration.

## Overview

The infrastructure transforms the document-scan-demo from a mock-data prototype to a production-ready system with:

- Secure S3 storage for documents and audio files
- DynamoDB for job tracking with automatic cleanup
- Secrets Manager for API key storage
- Event-driven processing via S3 notifications

## Architecture Components

### 1. S3 Buckets

#### Documents Bucket

- **Name**: `document-scan-documents-{env}-{accountId}`
- **Purpose**: Store uploaded medical documents (JPEG, PNG, PDF)
- **Encryption**: AWS KMS with customer-managed key
- **Lifecycle**: Automatic deletion after 90 days
- **CORS**: Enabled for presigned URL uploads
- **Max File Size**: 10 MB (enforced at application layer)

#### Audio Bucket

- **Name**: `document-scan-audio-{env}-{accountId}`
- **Purpose**: Store voice recordings for transcription
- **Encryption**: AWS KMS with customer-managed key
- **Lifecycle**: Automatic deletion after 90 days
- **CORS**: Enabled for presigned URL uploads
- **Format**: WAV files at 16 kHz sampling rate

### 2. DynamoDB Table

#### Jobs Table

- **Name**: `document-scan-jobs-{env}`
- **Primary Key**: `jobId` (String)
- **GSI**: `userId-createdAt-index` for querying user's jobs
  - Partition Key: `userId`
  - Sort Key: `createdAt`
- **TTL**: Enabled on `ttl` attribute (90 days)
- **Point-in-Time Recovery**: Enabled
- **Encryption**: Customer-managed KMS key

**Schema**:

```typescript
{
  jobId: string;           // Primary key
  userId: string;          // User who created the job
  type: 'document' | 'voice';
  status: 'uploading' | 'processing' | 'extracting' | 'transforming' | 'complete' | 'failed';
  message?: string;
  error?: string;
  s3Key?: string;
  documentUrl?: string;
  audioUrl?: string;
  language?: string;
  ocrText?: string;
  transcribedText?: string;
  detectedLanguage?: string;
  confidence?: number;
  needsReview?: boolean;
  entities?: Entity[];
  medications?: Medication[];
  conditions?: string[];
  labResults?: LabResult[];
  fhirResource?: object;
  createdAt: string;       // ISO timestamp
  updatedAt: string;
  processedAt?: string;
  ttl: number;            // Unix timestamp (createdAt + 90 days)
}
```

### 3. Secrets Manager

#### Sarvam API Key Secret

- **Name**: `document-scan/sarvam-api-key-{env}`
- **Format**: JSON with `apiKey` field
- **Purpose**: Store Sarvam API key for voice transcription

**Secret Structure**:

```json
{
  "apiKey": "your-sarvam-api-key-here"
}
```

### 4. S3 Event Notifications

#### Documents Bucket Notification

- **Event Type**: `s3:ObjectCreated:*` (all object creation events)
- **Destination**: Document Processor Lambda function
- **Filter**: Prefix `uploads/` (only triggers for files in uploads/ directory)
- **Purpose**: Automatically process documents when uploaded

#### Audio Bucket Notification

- **Event Type**: `s3:ObjectCreated:*` (all object creation events)
- **Destination**: Voice Processor Lambda function
- **Filter**: Prefix `uploads/` (only triggers for files in uploads/ directory)
- **Purpose**: Automatically transcribe audio when uploaded

**Configuration Details**:

- Event notifications are configured conditionally - only when Lambda functions are provided to the construct
- Lambda functions automatically receive permission to be invoked by S3
- Notifications use CDK's `LambdaDestination` for automatic permission management
- Filter ensures only files uploaded to `uploads/` prefix trigger processing

## Deployment

### Prerequisites

1. AWS CDK installed: `npm install -g aws-cdk`
2. AWS credentials configured
3. Environment configuration file in `infrastructure/config/{env}.json`

### Integration with Existing Stack

The `DocumentScanDemoConstruct` is designed to be integrated into the existing VaidyaLink stack:

```typescript
// In infrastructure/lib/vaidyalink-stack.ts

import { DocumentScanDemoConstruct } from './constructs/document-scan-demo';

// Add to VaidyaLinkStack constructor:
this.documentScanDemo = new DocumentScanDemoConstruct(this, 'DocumentScanDemo', {
  environment: config.environment,
  encryptionKey: this.security.encryptionKey,
  documentProcessorFunction: this.lambdaFunctions.documentProcessingFunction,
  voiceProcessorFunction: this.lambdaFunctions.voiceProcessingFunction,
});
```

### Deploy Commands

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### Post-Deployment Configuration

1. **Set Sarvam API Key**:

```bash
aws secretsmanager update-secret \
  --secret-id document-scan/sarvam-api-key-dev \
  --secret-string '{"apiKey":"your-actual-api-key"}'
```

2. **Update Frontend Environment Variables**:

```env
NEXT_PUBLIC_DOCUMENT_BUCKET=document-scan-documents-dev-{accountId}
NEXT_PUBLIC_AUDIO_BUCKET=document-scan-audio-dev-{accountId}
NEXT_PUBLIC_JOBS_TABLE=document-scan-jobs-dev
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## S3 Bucket Structure

### Documents Bucket

```
uploads/
  {userId}/
    {jobId}-{filename}.jpg
    {jobId}-{filename}.png
    {jobId}-{filename}.pdf
```

### Audio Bucket

```
uploads/
  {userId}/
    {jobId}-{filename}.wav
```

## Security Features

### Encryption

- **At Rest**: All S3 objects and DynamoDB items encrypted with customer-managed KMS keys
- **In Transit**: SSL/TLS enforced for all S3 operations
- **Bucket Keys**: Enabled to reduce KMS API calls and costs

### Access Control

- **S3**: Block all public access, bucket policies deny unencrypted uploads
- **DynamoDB**: IAM-based access control, encryption at rest
- **Secrets Manager**: IAM-based access, automatic rotation support

### Data Retention

- **S3 Lifecycle**: Automatic deletion after 90 days
- **DynamoDB TTL**: Automatic deletion after 90 days
- **Compliance**: Meets data retention requirements

## Cost Optimization

1. **S3 Bucket Keys**: Reduces KMS API calls by 99%
2. **DynamoDB On-Demand**: Pay only for actual usage
3. **Lifecycle Policies**: Automatic cleanup reduces storage costs
4. **VPC Endpoints**: Reduces data transfer costs (if Lambda functions are in VPC)

## Monitoring

### CloudWatch Metrics

- S3 bucket size and object count
- DynamoDB read/write capacity
- Lambda invocation counts and errors
- KMS API call counts

### CloudWatch Alarms

- High error rates on Lambda functions
- DynamoDB throttling
- S3 bucket size exceeding threshold

## Testing

### Unit Tests

```bash
cd infrastructure
npm test
```

### Integration Tests

```bash
# Test S3 upload with presigned URL
npm run test:integration -- --testNamePattern="S3 presigned URL"

# Test DynamoDB job creation
npm run test:integration -- --testNamePattern="DynamoDB job tracking"
```

## Troubleshooting

### Issue: S3 Upload Fails with Access Denied

- **Cause**: Presigned URL expired or incorrect permissions
- **Solution**: Ensure presigned URL is generated with correct expiration (3600s) and includes required headers

### Issue: Lambda Not Triggered on S3 Upload

- **Cause**: Event notification not configured or wrong prefix
- **Solution**: Verify S3 event notification is set for `uploads/` prefix and Lambda has permission

### Issue: DynamoDB Item Not Found

- **Cause**: TTL deleted the item or wrong partition key
- **Solution**: Check TTL value and ensure jobId is correct

### Issue: Cannot Read Sarvam API Key

- **Cause**: Lambda doesn't have permission to read secret
- **Solution**: Add `secretsmanager:GetSecretValue` permission to Lambda role

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)
