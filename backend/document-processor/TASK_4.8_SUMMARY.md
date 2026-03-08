# Task 4.8 Summary: Error Handling and Failure Status Updates

## Overview

Implemented comprehensive error handling for the document processor Lambda function with CloudWatch metrics emission and detailed logging.

## Changes Made

### 1. Added CloudWatch Client Initialization

**File**: `backend/document-processor/src/index.py`

Added CloudWatch client to emit custom metrics:

```python
cloudwatch = boto3.client('cloudwatch')
```

### 2. Enhanced `process_s3_event` Function

**Key Improvements**:

- Added top-level try-catch block to catch all unhandled exceptions
- Track processing start time for duration metrics
- Emit success metrics on completion (ProcessingSuccess, ProcessingDuration)
- Emit error metrics on failure with detailed dimensions
- Log all errors with full context including request ID, job ID, error type, and S3 record
- Ensure job status is updated to 'failed' even if nested error handlers fail

**Error Handling Flow**:

1. Catch exceptions at each processing stage (OCR, entity extraction, FHIR transformation)
2. Call `handle_processing_error` helper function
3. Top-level catch-all handler for any uncaught exceptions
4. Always update job status to 'failed' with error details
5. Always emit CloudWatch metrics for observability

### 3. Added `handle_processing_error` Helper Function

**Purpose**: Centralized error handling logic for processing failures

**Functionality**:

- Logs error with full context (job ID, stage, error type, error message)
- Updates job status to 'failed' in DynamoDB with metadata:
  - `failedAt`: ISO timestamp
  - `error`: Error message
  - `errorType`: Exception class name
  - `failedStage`: Processing stage where error occurred
- Emits CloudWatch metrics:
  - `ProcessingError` (Count) with dimensions: Status, ErrorType, Stage
  - `ProcessingDuration` (Seconds) with dimension: Status=Failed
- Handles errors gracefully if status update fails

### 4. Added `emit_processing_metric` Helper Function

**Purpose**: Emit custom CloudWatch metrics for monitoring

**Parameters**:

- `metric_name`: Name of the metric (e.g., 'ProcessingError', 'ProcessingSuccess')
- `value`: Metric value
- `unit`: Metric unit (e.g., 'Count', 'Seconds')
- `job_id`: Job identifier for logging
- `dimensions`: Optional custom dimensions

**Features**:

- Always includes 'Service: DocumentProcessor' dimension
- Supports custom dimensions for detailed filtering
- Namespace: 'DocumentScanDemo'
- Handles CloudWatch errors gracefully (logs but doesn't fail processing)

### 5. Success Metrics

Added success metrics emission when processing completes:

- `ProcessingSuccess` (Count) with dimension: Status=Success
- `ProcessingDuration` (Seconds) for successful processing

## CloudWatch Metrics Emitted

### Error Metrics

1. **ProcessingError** (Count)
   - Dimensions:
     - Service: DocumentProcessor
     - Status: Failed
     - ErrorType: Exception class name (e.g., ValueError, ClientError)
     - Stage: Processing stage (e.g., 'OCR extraction', 'Entity extraction', 'FHIR transformation')

2. **ProcessingDuration** (Seconds) - Failed
   - Dimensions:
     - Service: DocumentProcessor
     - Status: Failed

### Success Metrics

1. **ProcessingSuccess** (Count)
   - Dimensions:
     - Service: DocumentProcessor
     - Status: Success

2. **ProcessingDuration** (Seconds) - Success
   - Dimensions:
     - Service: DocumentProcessor

## Error Logging

All errors are logged with:

- Full stack trace (`exc_info=True`)
- Job ID for correlation
- Processing stage
- Error type and message
- Request ID
- S3 event details (for top-level errors)

## Job Status Updates

When processing fails, the job record in DynamoDB is updated with:

- `status`: 'failed'
- `message`: Descriptive error message including stage
- `failedAt`: ISO timestamp
- `error`: Error message
- `errorType`: Exception class name
- `failedStage`: Processing stage where error occurred
- `updatedAt`: ISO timestamp

## Testing

Created comprehensive unit tests in `backend/document-processor/src/__tests__/test_error_handling.py`:

1. ✅ `test_handle_processing_error_updates_job_status` - Verifies job status update to 'failed'
2. ✅ `test_handle_processing_error_emits_cloudwatch_metric` - Verifies CloudWatch metric emission
3. ✅ `test_emit_processing_metric_with_dimensions` - Verifies metric dimensions
4. ✅ `test_emit_processing_metric_handles_cloudwatch_errors` - Verifies graceful error handling
5. ✅ `test_process_s3_event_catches_all_exceptions` - Verifies top-level exception catching
6. ✅ `test_process_s3_event_emits_success_metrics_on_completion` - Verifies success metrics
7. ✅ `test_top_level_error_handler_logs_full_context` - Verifies comprehensive logging
8. ✅ `test_error_handler_includes_error_type_in_metadata` - Verifies error metadata
9. ✅ `test_error_metrics_include_stage_dimension` - Verifies stage dimension in metrics

## Requirements Validated

✅ **Requirement 2.10**: IF processing fails, THEN THE Document_Processor SHALL update Job_Status to 'failed' with error details

## Benefits

1. **Observability**: CloudWatch metrics enable monitoring of error rates, processing duration, and failure patterns
2. **Debugging**: Comprehensive logging with full context makes troubleshooting easier
3. **User Experience**: Job status updates ensure users are informed of failures
4. **Reliability**: Graceful error handling prevents cascading failures
5. **Monitoring**: Metrics can be used to create CloudWatch alarms for proactive alerting

## Example Error Flow

```
1. OCR extraction fails with "Invalid image format"
2. Exception caught in process_s3_event
3. handle_processing_error called with:
   - job_id: "job-123"
   - stage: "OCR extraction"
   - error: Exception("Invalid image format")
4. Job status updated to 'failed' in DynamoDB
5. CloudWatch metrics emitted:
   - ProcessingError: 1 (Count) [Status=Failed, ErrorType=Exception, Stage=OCR extraction]
   - ProcessingDuration: 2.5 (Seconds) [Status=Failed]
6. Error logged with full context
7. Exception re-raised to mark Lambda execution as failed
```

## Next Steps

- Task 4.10: Add CloudWatch logging and metrics for processing events
- Task 5: Checkpoint - Verify document processing pipeline
- Configure CloudWatch alarms based on error metrics (Task 15.2)
