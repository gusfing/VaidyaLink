# DynamoDB Query Helpers (Python)

Optimized query utilities for VaidyaLink DynamoDB tables. These helpers use Global Secondary Indexes (GSIs) efficiently and implement best practices for pagination, filtering, and batch operations.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Queries

```python
from dynamodb.query_helpers import (
    get_patient_scans,
    get_scans_by_status,
    get_hitl_queue,
    get_patient_by_abha,
    get_scan_job,
)

# Get all scans for a patient (most recent first)
result = get_patient_scans('patient-123', limit=20, ascending=False)

print(result['items'])  # List of scan jobs
print(result['last_evaluated_key'])  # Pagination token

# Get HITL verification queue
hitl_jobs = get_hitl_queue(limit=20)

# Find patient by ABHA ID
patient = get_patient_by_abha('12-3456-7890-1234')

# Get single scan job
job = get_scan_job('job-123')
```

### Pagination

```python
# Paginate through all patient scans
all_scans = []
last_key = None

while True:
    result = get_patient_scans(
        'patient-123',
        limit=100,
        last_evaluated_key=last_key
    )

    all_scans.extend(result['items'])
    last_key = result['last_evaluated_key']

    if not last_key:
        break

# Or use the helper function
all_scans = get_all_patient_scans('patient-123')
```

### Date Range Filtering

```python
from datetime import datetime, timedelta

# Get scans from the last 30 days
thirty_days_ago = datetime.utcnow() - timedelta(days=30)

recent_scans = get_patient_scans(
    'patient-123',
    start_date=thirty_days_ago.isoformat(),
    limit=50
)

# Or use the date range helper
scans = get_scans_by_date_range(
    patient_id='patient-123',
    start_date='2024-01-01T00:00:00Z',
    end_date='2024-01-31T23:59:59Z'
)
```

### Batch Operations

```python
# Get multiple scan jobs efficiently
jobs = get_batch_scan_jobs(['job-1', 'job-2', 'job-3'])

# Note: Maximum 25 items per batch
```

### Status-Based Queries

```python
# Get all pending scans
pending_scans = get_scans_by_status('pending', limit=50, ascending=True)

# Get all failed scans
failed_scans = get_failed_scans(limit=50)

# Get recent completed scans (admin view)
completed_scans = get_recent_completed_scans(limit=50)
```

## API Reference

### `get_patient_scans(patient_id, **options)`

Query all scan jobs for a specific patient using PatientIndex GSI.

**Parameters:**

- `patient_id` (str): Patient identifier
- `limit` (int): Maximum items to return (default: 20)
- `ascending` (bool): Sort order (default: False = newest first)
- `start_date` (str): ISO 8601 date to filter from
- `last_evaluated_key` (dict): Pagination token

**Returns:** `dict` with keys: `items`, `last_evaluated_key`, `count`

### `get_scans_by_status(status, **options)`

Query all scan jobs by status using StatusIndex GSI.

**Parameters:**

- `status` (str): Job status (`pending`, `processing`, `completed`, `failed`, `hitl_required`)
- `limit` (int): Maximum items to return (default: 50)
- `ascending` (bool): Sort order (default: True = oldest first)
- `last_evaluated_key` (dict): Pagination token

**Returns:** `dict` with keys: `items`, `last_evaluated_key`, `count`

### `get_hitl_queue(limit=20)`

Get HITL verification queue (jobs requiring human verification).

**Parameters:**

- `limit` (int): Maximum items to return (default: 20)

**Returns:** `list` - List of scan jobs

### `get_patient_by_abha(abha_id)`

Find patient by ABHA ID using ABHAIndex GSI.

**Parameters:**

- `abha_id` (str): Ayushman Bharat Health Account ID

**Returns:** `dict` or `None` - Patient object or None if not found

### `get_scan_job(job_id)`

Get a single scan job by ID using primary key lookup.

**Parameters:**

- `job_id` (str): Scan job identifier

**Returns:** `dict` or `None` - Scan job object or None if not found

### `get_batch_scan_jobs(job_ids)`

Get multiple scan jobs by IDs using batch_get_item.

**Parameters:**

- `job_ids` (list): List of job identifiers (max 25)

**Returns:** `list` - List of scan job objects

**Raises:** `ValueError` if more than 25 job IDs provided

### `get_all_patient_scans(patient_id, max_items=1000)`

Paginate through all scans for a patient automatically.

**Parameters:**

- `patient_id` (str): Patient identifier
- `max_items` (int): Maximum total items to fetch (default: 1000)

**Returns:** `list` - All scan jobs for the patient

### `get_scans_by_date_range(patient_id, start_date, end_date=None, limit=100)`

Get scans for a patient within a date range.

**Parameters:**

- `patient_id` (str): Patient identifier
- `start_date` (str): ISO 8601 start date
- `end_date` (str): ISO 8601 end date (optional, defaults to now)
- `limit` (int): Maximum items to return

**Returns:** `list` - List of scan jobs within the date range

### `get_failed_scans(limit=50)`

Get all failed scan jobs for monitoring.

**Parameters:**

- `limit` (int): Maximum items to return (default: 50)

**Returns:** `list` - List of failed scan jobs

### `get_pending_scans(limit=50)`

Get all pending scan jobs for monitoring.

**Parameters:**

- `limit` (int): Maximum items to return (default: 50)

**Returns:** `list` - List of pending scan jobs

## Environment Variables

- `AWS_REGION`: AWS region (default: `ap-south-1`)
- `ENVIRONMENT`: Environment name (default: `dev`)

## Performance Considerations

### Query Latency Targets

| Operation                 | Target P99 Latency |
| ------------------------- | ------------------ |
| get_item (primary key)    | <5ms               |
| query (PatientIndex)      | <20ms              |
| query (StatusIndex)       | <50ms              |
| query (ABHAIndex)         | <5ms               |
| batch_get_item (25 items) | <30ms              |

### Best Practices

1. **Always use indexes** - Never use table scans
2. **Implement pagination** - Use `limit` and `last_evaluated_key`
3. **Use projection expressions** - Fetch only required attributes for large items
4. **Leverage sort key conditions** - Filter by date ranges when possible
5. **Batch operations** - Use `get_batch_scan_jobs` for multiple items

### Cost Optimization

- **Pay-per-request billing**: No idle costs
- **Request costs**: $0.25 per million reads, $1.25 per million writes
- **Storage costs**: $0.25 per GB-month (base table + GSIs)

## Testing

```bash
pytest test_query_helpers.py -v
```

## Example Lambda Handler

```python
import json
from dynamodb.query_helpers import get_patient_scans, get_hitl_queue

def lambda_handler(event, context):
    """Example Lambda handler using query helpers"""

    # Get patient scans
    patient_id = event['pathParameters']['patientId']
    result = get_patient_scans(patient_id, limit=20)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'scans': result['items'],
            'nextToken': result['last_evaluated_key'],
        })
    }

def hitl_queue_handler(event, context):
    """Get HITL verification queue"""

    queue = get_hitl_queue(limit=50)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'queue': queue,
            'count': len(queue),
        })
    }
```

## Related Documentation

- [DynamoDB Index Optimization Guide](../../../../infrastructure/docs/DYNAMODB_INDEX_OPTIMIZATION.md)
- [DynamoDB Tables Reference](../../../../infrastructure/docs/DYNAMODB_TABLES.md)
- [Storage Construct](../../../../infrastructure/lib/constructs/storage.ts)

## License

Proprietary - VaidyaLink
