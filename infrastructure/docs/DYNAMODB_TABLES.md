# DynamoDB Tables Reference

This document provides a quick reference for the DynamoDB tables used in VaidyaLink.

## Overview

VaidyaLink uses three DynamoDB tables to manage application state:

1. **ScanJobs** - Tracks document processing jobs
2. **Patients** - Stores patient demographics and profiles
3. **VoiceJobs** - Tracks voice transcription jobs

All tables use:

- **Pay-per-request billing** for cost efficiency
- **Customer-managed KMS encryption** for HIPAA compliance
- **Point-in-time recovery** for data protection
- **Single-table design pattern** with PK/SK composite keys

## Table Schemas

### ScanJobs Table

**Table Name**: `vaidyalink-scanjobs-{environment}`

**Primary Key**:

- Partition Key (PK): `STRING` - Format: `JOB#{jobId}`
- Sort Key (SK): `STRING` - Format: `METADATA`

**Attributes**:

```typescript
{
  PK: string;                    // "JOB#${jobId}"
  SK: string;                    // "METADATA"
  jobId: string;
  patientId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'hitl_required';
  imageS3Key: string;
  imageS3Bucket: string;
  createdAt: string;             // ISO 8601
  updatedAt: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  extractedDataS3Key?: string;
  fhirResourceIds?: string[];
  confidenceScores?: Record<string, number>;
  errorMessage?: string;
  hitlAssignedTo?: string;
  hitlCompletedAt?: string;
}
```

**Global Secondary Indexes**:

1. **PatientIndex**
   - Partition Key: `patientId` (STRING)
   - Sort Key: `createdAt` (STRING)
   - Projection: ALL
   - Use case: Query all scans for a specific patient

2. **StatusIndex**
   - Partition Key: `status` (STRING)
   - Sort Key: `createdAt` (STRING)
   - Projection: ALL
   - Use case: Query scans by status (e.g., all pending HITL jobs)

**DynamoDB Streams**: Enabled (NEW_AND_OLD_IMAGES)

### Patients Table

**Table Name**: `vaidyalink-patients-{environment}`

**Primary Key**:

- Partition Key (PK): `STRING` - Format: `PATIENT#{patientId}`
- Sort Key (SK): `STRING` - Format: `PROFILE`

**Attributes**:

```typescript
{
  PK: string;                    // "PATIENT#${patientId}"
  SK: string;                    // "PROFILE"
  patientId: string;
  abhaId?: string;               // Ayushman Bharat Health Account ID
  name: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
  fhirPatientId: string;         // HealthLake Patient resource ID
}
```

**Global Secondary Indexes**:

1. **ABHAIndex**
   - Partition Key: `abhaId` (STRING)
   - Projection: ALL
   - Use case: Look up patient by ABHA ID

### VoiceJobs Table

**Table Name**: `vaidyalink-voicejobs-{environment}`

**Primary Key**:

- Partition Key (PK): `STRING` - Format: `VOICE#{jobId}`
- Sort Key (SK): `STRING` - Format: `METADATA`

**Attributes**:

```typescript
{
  PK: string;                    // "VOICE#${jobId}"
  SK: string;                    // "METADATA"
  jobId: string;
  patientId: string;
  status: 'pending' | 'transcribing' | 'confirming' | 'completed' | 'failed';
  audioS3Key: string;
  language: string;              // ISO 639-1 code
  transcription?: string;
  transcriptionConfidence?: number;
  confirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  fhirResourceIds?: string[];
}
```

**Global Secondary Indexes**:

1. **PatientIndex**
   - Partition Key: `patientId` (STRING)
   - Sort Key: `createdAt` (STRING)
   - Projection: ALL
   - Use case: Query all voice jobs for a specific patient

## Access Patterns

### Common Query Patterns

1. **Get scan job by ID**

   ```typescript
   const params = {
     TableName: 'vaidyalink-scanjobs-dev',
     Key: {
       PK: `JOB#${jobId}`,
       SK: 'METADATA',
     },
   };
   ```

2. **Get all scans for a patient**

   ```typescript
   const params = {
     TableName: 'vaidyalink-scanjobs-dev',
     IndexName: 'PatientIndex',
     KeyConditionExpression: 'patientId = :patientId',
     ExpressionAttributeValues: {
       ':patientId': patientId,
     },
     ScanIndexForward: false, // Most recent first
   };
   ```

3. **Get all pending HITL jobs**

   ```typescript
   const params = {
     TableName: 'vaidyalink-scanjobs-dev',
     IndexName: 'StatusIndex',
     KeyConditionExpression: '#status = :status',
     ExpressionAttributeNames: {
       '#status': 'status',
     },
     ExpressionAttributeValues: {
       ':status': 'hitl_required',
     },
   };
   ```

4. **Look up patient by ABHA ID**
   ```typescript
   const params = {
     TableName: 'vaidyalink-patients-dev',
     IndexName: 'ABHAIndex',
     KeyConditionExpression: 'abhaId = :abhaId',
     ExpressionAttributeValues: {
       ':abhaId': abhaId,
     },
   };
   ```

## Security Features

### Encryption at Rest

- All tables use **customer-managed KMS keys**
- Encryption key is separate from S3 encryption key
- Keys support automatic rotation

### Encryption in Transit

- All DynamoDB API calls use TLS 1.3
- Enforced via API Gateway and Lambda execution role policies

### Access Control

- Lambda functions have least-privilege IAM roles
- Table access is granted per-function basis
- No direct public access to tables

### Audit Logging

- All table operations logged to CloudTrail
- DynamoDB Streams enabled for ScanJobs table
- Point-in-time recovery enabled for all tables

## Backup and Recovery

### Point-in-Time Recovery (PITR)

- Enabled on all tables
- Allows restore to any point in the last 35 days
- No performance impact

### Deletion Protection

- All tables have `RETAIN` removal policy
- Tables will not be deleted when CloudFormation stack is deleted
- Manual deletion required for production tables

## Cost Optimization

### Billing Mode

- **Pay-per-request** billing for all tables
- No idle costs when not in use
- Automatically scales with traffic

### Estimated Costs (per 1000 scans)

- Write requests: ~3 writes per scan = 3000 writes
- Read requests: ~10 reads per scan = 10,000 reads
- Storage: ~1KB per scan = 1MB total
- **Total cost**: ~$0.015 per 1000 scans

## Monitoring

### CloudWatch Metrics

- `UserErrors` - Client-side errors (4xx)
- `SystemErrors` - Server-side errors (5xx)
- `ConsumedReadCapacityUnits` - Read throughput
- `ConsumedWriteCapacityUnits` - Write throughput
- `ThrottledRequests` - Rate-limited requests

### Alarms

- High error rate (>5% over 5 minutes)
- Throttling detected
- Unusual read/write patterns

## Local Development

### LocalStack Configuration

For local development, tables are created automatically by the seed script:

```bash
./scripts/seed-database.sh
```

This creates tables in LocalStack with the same schema as production.

## Query Optimization

For detailed information on index optimization, query patterns, and performance best practices, see:

- [DynamoDB Index Optimization Guide](./DYNAMODB_INDEX_OPTIMIZATION.md) - Comprehensive optimization guide
- [Node.js Query Helpers](../../backend/shared/nodejs/dynamodb/README.md) - Optimized query utilities
- [Python Query Helpers](../../backend/shared/python/dynamodb/README.md) - Optimized query utilities

## Related Documentation

- [Storage Construct](../lib/constructs/storage.ts) - CDK implementation
- [Storage Tests](../test/storage.test.ts) - Comprehensive test suite
- [Field Encryption](../../backend/shared/FIELD_ENCRYPTION_INTEGRATION.md) - PHI encryption guide
- [KMS Setup](./KMS_SETUP.md) - Encryption key configuration
