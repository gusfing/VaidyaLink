# DynamoDB Query Helpers

Optimized query utilities for VaidyaLink DynamoDB tables. These helpers use Global Secondary Indexes (GSIs) efficiently and implement best practices for pagination, filtering, and batch operations.

## Installation

```bash
npm install @vaidyalink/dynamodb-helpers
```

## Usage

### Basic Queries

```javascript
const {
  getPatientScans,
  getScansByStatus,
  getHITLQueue,
  getPatientByABHA,
  getScanJob,
} = require('@vaidyalink/dynamodb-helpers');

// Get all scans for a patient (most recent first)
const result = await getPatientScans('patient-123', {
  limit: 20,
  ascending: false,
});

console.log(result.items); // Array of scan jobs
console.log(result.lastEvaluatedKey); // Pagination token

// Get HITL verification queue
const hitlJobs = await getHITLQueue({ limit: 20 });

// Find patient by ABHA ID
const patient = await getPatientByABHA('12-3456-7890-1234');

// Get single scan job
const job = await getScanJob('job-123');
```

### Pagination

```javascript
// Paginate through all patient scans
let allScans = [];
let lastKey = null;

do {
  const result = await getPatientScans('patient-123', {
    limit: 100,
    lastEvaluatedKey: lastKey,
  });

  allScans.push(...result.items);
  lastKey = result.lastEvaluatedKey;
} while (lastKey);

// Or use the helper function
const allScans = await getAllPatientScans('patient-123');
```

### Date Range Filtering

```javascript
// Get scans from the last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const recentScans = await getPatientScans('patient-123', {
  startDate: thirtyDaysAgo.toISOString(),
  limit: 50,
});
```

### Batch Operations

```javascript
// Get multiple scan jobs efficiently
const jobs = await getBatchScanJobs(['job-1', 'job-2', 'job-3']);

// Note: Maximum 25 items per batch
```

### Status-Based Queries

```javascript
// Get all pending scans
const pendingScans = await getScansByStatus('pending', {
  limit: 50,
  ascending: true, // FIFO processing
});

// Get all failed scans
const failedScans = await getScansByStatus('failed', {
  limit: 50,
  ascending: false, // Most recent first
});

// Get recent completed scans (admin view)
const completedScans = await getRecentCompletedScans({ limit: 50 });
```

## API Reference

### `getPatientScans(patientId, options)`

Query all scan jobs for a specific patient using PatientIndex GSI.

**Parameters:**

- `patientId` (string): Patient identifier
- `options` (object):
  - `limit` (number): Maximum items to return (default: 20)
  - `ascending` (boolean): Sort order (default: false = newest first)
  - `startDate` (string): ISO 8601 date to filter from
  - `lastEvaluatedKey` (object): Pagination token

**Returns:** `Promise<{items: Array, lastEvaluatedKey: Object, count: number}>`

### `getScansByStatus(status, options)`

Query all scan jobs by status using StatusIndex GSI.

**Parameters:**

- `status` (string): Job status (`pending`, `processing`, `completed`, `failed`, `hitl_required`)
- `options` (object):
  - `limit` (number): Maximum items to return (default: 50)
  - `ascending` (boolean): Sort order (default: true = oldest first)
  - `lastEvaluatedKey` (object): Pagination token

**Returns:** `Promise<{items: Array, lastEvaluatedKey: Object, count: number}>`

### `getHITLQueue(options)`

Get HITL verification queue (jobs requiring human verification).

**Parameters:**

- `options` (object):
  - `limit` (number): Maximum items to return (default: 20)

**Returns:** `Promise<Array>` - Array of scan jobs

### `getPatientByABHA(abhaId)`

Find patient by ABHA ID using ABHAIndex GSI.

**Parameters:**

- `abhaId` (string): Ayushman Bharat Health Account ID

**Returns:** `Promise<Object|null>` - Patient object or null if not found

### `getScanJob(jobId)`

Get a single scan job by ID using primary key lookup.

**Parameters:**

- `jobId` (string): Scan job identifier

**Returns:** `Promise<Object|null>` - Scan job object or null if not found

### `getBatchScanJobs(jobIds)`

Get multiple scan jobs by IDs using BatchGetItem.

**Parameters:**

- `jobIds` (Array<string>): Array of job identifiers (max 25)

**Returns:** `Promise<Array>` - Array of scan job objects

**Throws:** Error if more than 25 job IDs provided

### `getAllPatientScans(patientId, options)`

Paginate through all scans for a patient automatically.

**Parameters:**

- `patientId` (string): Patient identifier
- `options` (object):
  - `maxItems` (number): Maximum total items to fetch (default: 1000)

**Returns:** `Promise<Array>` - All scan jobs for the patient

## Environment Variables

- `AWS_REGION`: AWS region (default: `ap-south-1`)
- `ENVIRONMENT`: Environment name (default: `dev`)

## Performance Considerations

### Query Latency Targets

| Operation               | Target P99 Latency |
| ----------------------- | ------------------ |
| GetItem (primary key)   | <5ms               |
| Query (PatientIndex)    | <20ms              |
| Query (StatusIndex)     | <50ms              |
| Query (ABHAIndex)       | <5ms               |
| BatchGetItem (25 items) | <30ms              |

### Best Practices

1. **Always use indexes** - Never use table scans
2. **Implement pagination** - Use `limit` and `lastEvaluatedKey`
3. **Use projection expressions** - Fetch only required attributes for large items
4. **Leverage sort key conditions** - Filter by date ranges when possible
5. **Batch operations** - Use `getBatchScanJobs` for multiple items

### Cost Optimization

- **Pay-per-request billing**: No idle costs
- **Request costs**: $0.25 per million reads, $1.25 per million writes
- **Storage costs**: $0.25 per GB-month (base table + GSIs)

## Testing

```bash
npm test
```

## Related Documentation

- [DynamoDB Index Optimization Guide](../../../../infrastructure/docs/DYNAMODB_INDEX_OPTIMIZATION.md)
- [DynamoDB Tables Reference](../../../../infrastructure/docs/DYNAMODB_TABLES.md)
- [Storage Construct](../../../../infrastructure/lib/constructs/storage.ts)

## License

Proprietary - VaidyaLink
