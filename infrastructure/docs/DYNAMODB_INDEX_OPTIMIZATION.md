# DynamoDB Index Optimization Guide

## Overview

This document describes the Global Secondary Indexes (GSIs) configured for VaidyaLink's DynamoDB tables and provides guidance on query optimization patterns.

## Index Strategy

VaidyaLink uses a **single-table design pattern** with strategic GSIs to support all access patterns efficiently. All indexes use:

- **Pay-per-request billing** - No idle costs
- **ALL projection type** - Full item data in indexes for read efficiency
- **Sparse indexes** - Only items with the indexed attribute are included

## ScanJobs Table Indexes

### Primary Key Structure

```
PK: "JOB#{jobId}"
SK: "METADATA"
```

### GSI 1: PatientIndex

**Purpose**: Query all scan jobs for a specific patient, sorted chronologically

**Key Schema**:

- Partition Key: `patientId` (STRING)
- Sort Key: `createdAt` (STRING, ISO 8601 format)

**Projection**: ALL

**Access Pattern**:

```typescript
// Get all scans for a patient (most recent first)
const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  IndexName: 'PatientIndex',
  KeyConditionExpression: 'patientId = :patientId',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
  },
  ScanIndexForward: false, // Descending order (newest first)
  Limit: 20, // Pagination
};
```

**Use Cases**:

- Patient dashboard showing recent scans
- Medical history timeline
- Export all patient records
- Audit trail for specific patient

**Performance Characteristics**:

- Query latency: <10ms for typical patient (10-100 scans)
- Supports efficient pagination with LastEvaluatedKey
- Strongly consistent reads NOT available (GSI limitation)

### GSI 2: StatusIndex

**Purpose**: Query all jobs by processing status for workflow management

**Key Schema**:

- Partition Key: `status` (STRING)
- Sort Key: `createdAt` (STRING, ISO 8601 format)

**Projection**: ALL

**Access Pattern**:

```typescript
// Get all pending HITL verification jobs
const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  IndexName: 'StatusIndex',
  KeyConditionExpression: '#status = :status',
  ExpressionAttributeNames: {
    '#status': 'status', // 'status' is a reserved word
  },
  ExpressionAttributeValues: {
    ':status': 'hitl_required',
  },
  ScanIndexForward: true, // Oldest first (FIFO processing)
};
```

**Use Cases**:

- HITL verification queue
- Failed job monitoring
- Processing pipeline metrics
- Admin dashboard statistics

**Status Values**:

- `pending` - Awaiting processing
- `processing` - Currently being processed
- `completed` - Successfully completed
- `failed` - Processing failed
- `hitl_required` - Needs human verification

**Performance Characteristics**:

- Query latency: <20ms for typical status partition (100-1000 items)
- Hot partition risk: `pending` status may have high write throughput
- Mitigation: Pay-per-request billing handles bursts automatically

## Patients Table Indexes

### Primary Key Structure

```
PK: "PATIENT#{patientId}"
SK: "PROFILE"
```

### GSI 1: ABHAIndex

**Purpose**: Look up patient by Ayushman Bharat Health Account (ABHA) ID

**Key Schema**:

- Partition Key: `abhaId` (STRING)
- No Sort Key (1:1 relationship)

**Projection**: ALL

**Access Pattern**:

```typescript
// Find patient by ABHA ID
const params = {
  TableName: 'vaidyalink-patients-dev',
  IndexName: 'ABHAIndex',
  KeyConditionExpression: 'abhaId = :abhaId',
  ExpressionAttributeValues: {
    ':abhaId': '12-3456-7890-1234',
  },
};
```

**Use Cases**:

- ABDM integration - link existing ABHA ID
- Patient authentication via ABHA
- Cross-facility patient lookup
- Medical tourism record retrieval

**Performance Characteristics**:

- Query latency: <5ms (single item lookup)
- Sparse index: Only patients with linked ABHA IDs are indexed
- Unique constraint: Application-level enforcement required

**Important Notes**:

- `abhaId` is optional - not all patients have ABHA IDs
- Sparse index saves storage costs
- Application must handle duplicate ABHA IDs (should never occur)

## VoiceJobs Table Indexes

### Primary Key Structure

```
PK: "VOICE#{jobId}"
SK: "METADATA"
```

### GSI 1: PatientIndex

**Purpose**: Query all voice transcription jobs for a specific patient

**Key Schema**:

- Partition Key: `patientId` (STRING)
- Sort Key: `createdAt` (STRING, ISO 8601 format)

**Projection**: ALL

**Access Pattern**:

```typescript
// Get all voice recordings for a patient
const params = {
  TableName: 'vaidyalink-voicejobs-dev',
  IndexName: 'PatientIndex',
  KeyConditionExpression: 'patientId = :patientId',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
  },
  ScanIndexForward: false, // Most recent first
};
```

**Use Cases**:

- Voice history timeline
- Patient-reported symptoms tracking
- Multilingual transcription history
- Audit trail for voice data

**Performance Characteristics**:

- Query latency: <10ms for typical patient (5-50 voice recordings)
- Lower volume than ScanJobs (voice is less frequent)

## Query Optimization Best Practices

### 1. Use Indexes for All Queries

**❌ Bad - Table Scan**:

```typescript
// NEVER DO THIS - Scans entire table
const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  FilterExpression: 'patientId = :patientId',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
  },
};
await dynamodb.scan(params).promise();
```

**✅ Good - Index Query**:

```typescript
// Use PatientIndex for efficient query
const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  IndexName: 'PatientIndex',
  KeyConditionExpression: 'patientId = :patientId',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
  },
};
await dynamodb.query(params).promise();
```

### 2. Implement Pagination

**✅ Proper Pagination**:

```typescript
async function getAllPatientScans(patientId: string) {
  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: 'vaidyalink-scanjobs-dev',
      IndexName: 'PatientIndex',
      KeyConditionExpression: 'patientId = :patientId',
      ExpressionAttributeValues: {
        ':patientId': patientId,
      },
      Limit: 100,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await dynamodb.query(params).promise();
    items.push(...result.Items);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}
```

### 3. Use Projection Expressions for Large Items

**✅ Fetch Only Required Attributes**:

```typescript
// Only fetch status and timestamps (not full item)
const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  IndexName: 'PatientIndex',
  KeyConditionExpression: 'patientId = :patientId',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
  },
  ProjectionExpression: 'jobId, #status, createdAt, updatedAt',
  ExpressionAttributeNames: {
    '#status': 'status',
  },
};
```

### 4. Leverage Sort Key Conditions

**✅ Query Recent Items Only**:

```typescript
// Get scans from last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const params = {
  TableName: 'vaidyalink-scanjobs-dev',
  IndexName: 'PatientIndex',
  KeyConditionExpression: 'patientId = :patientId AND createdAt >= :startDate',
  ExpressionAttributeValues: {
    ':patientId': 'patient-123',
    ':startDate': thirtyDaysAgo.toISOString(),
  },
};
```

### 5. Batch Operations for Multiple Items

**✅ Use BatchGetItem for Multiple Jobs**:

```typescript
// Fetch multiple scan jobs efficiently
const params = {
  RequestItems: {
    'vaidyalink-scanjobs-dev': {
      Keys: [
        { PK: 'JOB#job-1', SK: 'METADATA' },
        { PK: 'JOB#job-2', SK: 'METADATA' },
        { PK: 'JOB#job-3', SK: 'METADATA' },
      ],
    },
  },
};
await dynamodb.batchGetItem(params).promise();
```

## Performance Monitoring

### Key CloudWatch Metrics

Monitor these metrics for index performance:

1. **ConsumedReadCapacityUnits** (per index)
   - Track read throughput on each GSI
   - Alert if consistently high (may indicate inefficient queries)

2. **UserErrors**
   - Track `ProvisionedThroughputExceededException` (shouldn't occur with pay-per-request)
   - Track `ValidationException` (query syntax errors)

3. **SuccessfulRequestLatency**
   - P50, P90, P99 latencies for Query operations
   - Alert if P99 > 50ms

4. **ThrottledRequests**
   - Should be zero with pay-per-request billing
   - If non-zero, indicates AWS service limits reached

### Query Performance Targets

| Operation               | Target Latency (P99) | Notes                            |
| ----------------------- | -------------------- | -------------------------------- |
| GetItem (primary key)   | <5ms                 | Direct key lookup                |
| Query (PatientIndex)    | <20ms                | Typical patient has 10-100 items |
| Query (StatusIndex)     | <50ms                | May return 100-1000 items        |
| Query (ABHAIndex)       | <5ms                 | Single item lookup               |
| BatchGetItem (25 items) | <30ms                | Parallel retrieval               |

## Cost Optimization

### Index Cost Breakdown

**Storage Costs**:

- Base table: $0.25 per GB-month
- Each GSI: $0.25 per GB-month (same as base table)
- Total: Base + (Number of GSIs × Item Size)

**Request Costs** (Pay-per-request):

- Read: $0.25 per million requests
- Write: $1.25 per million requests
- GSI writes: Automatically replicated (no extra cost)

### Cost Optimization Strategies

1. **Use Sparse Indexes**
   - ABHAIndex only indexes patients with ABHA IDs
   - Saves storage costs for patients without ABHA

2. **Projection Type = ALL**
   - Avoids additional reads to base table
   - Slightly higher storage cost, but better read performance
   - Optimal for VaidyaLink's read-heavy workload

3. **Efficient Pagination**
   - Use `Limit` parameter to control page size
   - Avoid fetching all items when only recent items needed

4. **Caching Layer**
   - Cache frequently accessed patient profiles
   - Cache HITL queue status (refreshed every 30 seconds)
   - Reduces DynamoDB read requests

## Index Maintenance

### Automatic Maintenance

DynamoDB automatically maintains GSIs:

- Index updates are asynchronous (eventual consistency)
- Write to base table triggers automatic GSI update
- No manual maintenance required

### Monitoring Index Health

Check these indicators:

1. **Index Status**: Should always be `ACTIVE`
2. **Index Size**: Should grow proportionally with base table
3. **Write Throttling**: Should be zero with pay-per-request

### Handling Index Backfill

When adding a new GSI to an existing table:

- DynamoDB backfills the index automatically
- Index status: `CREATING` → `ACTIVE`
- Backfill time: ~1 hour per 1 million items
- No downtime for base table operations

## Future Index Considerations

### Potential Additional Indexes

If access patterns change, consider these indexes:

1. **ScanJobs: HITLAssigneeIndex**
   - Partition Key: `hitlAssignedTo`
   - Sort Key: `createdAt`
   - Use case: Show all jobs assigned to a specific verifier

2. **ScanJobs: UpdatedAtIndex**
   - Partition Key: `patientId`
   - Sort Key: `updatedAt`
   - Use case: Show recently updated scans (not just created)

3. **Patients: PhoneIndex**
   - Partition Key: `phone`
   - Use case: Patient lookup by phone number

**Decision Criteria**:

- Add index only if query pattern is frequent (>10% of queries)
- Consider storage cost (each GSI doubles storage for indexed items)
- Evaluate if application-level caching can solve the problem

## Related Documentation

- [DynamoDB Tables Reference](./DYNAMODB_TABLES.md) - Table schemas and access patterns
- [Storage Construct](../lib/constructs/storage.ts) - CDK implementation
- [Storage Tests](../test/storage.test.ts) - Comprehensive test suite
- [Field Encryption](../../backend/shared/FIELD_ENCRYPTION_INTEGRATION.md) - PHI encryption guide
