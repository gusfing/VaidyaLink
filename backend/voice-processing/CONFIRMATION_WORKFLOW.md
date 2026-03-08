# Voice Confirmation Workflow

## Overview

The confirmation workflow (Task 10.7) enables users to review and confirm voice transcriptions before they are processed into structured clinical data. This is critical for ensuring accuracy when transcription confidence is below the threshold.

## Workflow States

```
┌─────────────┐
│  Recording  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Transcribing │
└──────┬──────┘
       │
       ├─── High Confidence (≥75%) ──────┐
       │                                  │
       │                                  ▼
       │                          ┌──────────────┐
       │                          │  Extracting  │
       │                          │   Entities   │
       │                          └──────┬───────┘
       │                                  │
       │                                  ▼
       │                          ┌──────────────┐
       │                          │  Completed   │
       │                          └──────────────┘
       │
       └─── Low Confidence (<75%) ───────┐
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │  Confirming  │◄─── User reviews
                                  └──────┬───────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                    User Accepts                    User Rejects
                         │                               │
                         ▼                               ▼
                 ┌──────────────┐                ┌──────────────┐
                 │  Extracting  │                │   Rejected   │
                 │   Entities   │                └──────────────┘
                 └──────┬───────┘
                         │
                         ▼
                 ┌──────────────┐
                 │  Completed   │
                 └──────────────┘
```

## API Endpoints

### 1. POST /api/v1/voice/{jobId}/confirm

Processes user confirmation decision for a transcription.

**Request Body:**

```json
{
  "jobId": "voice-job-123",
  "confirmed": true,
  "editedTranscription": "Optional edited text if user corrected the transcription"
}
```

**Response (Accepted):**

```json
{
  "message": "Confirmation processed successfully",
  "jobId": "voice-job-123",
  "status": "completed",
  "entityCount": 5
}
```

**Response (Rejected):**

```json
{
  "message": "Transcription rejected. Please re-record.",
  "jobId": "voice-job-123",
  "status": "rejected"
}
```

**Error Responses:**

- `400 Bad Request` - Missing or invalid fields
- `404 Not Found` - Job not found
- `409 Conflict` - Job not in confirming state
- `500 Internal Server Error` - Processing error

### 2. GET /api/v1/voice/{jobId}

Retrieves current status of a voice job for client polling.

**Response:**

```json
{
  "jobId": "voice-job-123",
  "status": "confirming",
  "transcription": "Patient has fever and headache for two days",
  "detectedLanguage": "en",
  "transcriptionConfidence": 0.72,
  "needsConfirmation": true,
  "playbackAudioUrl": "https://s3.amazonaws.com/bucket/playback/job-123/confirmation.mp3",
  "playbackAudioFormat": "mp3",
  "updatedAt": "2024-01-15T10:05:00Z"
}
```

**Status Values:**

- `pending` - Job created, awaiting processing
- `transcribing` - Audio being transcribed
- `confirming` - Awaiting user confirmation
- `completed` - Processing complete
- `rejected` - User rejected transcription
- `failed` - Processing error occurred

## Implementation Details

### Confidence Threshold

The system routes transcriptions to confirmation when:

```javascript
transcriptionConfidence < TRANSCRIPTION_CONFIDENCE_THRESHOLD;
```

Default threshold: **0.75** (75%)

Configure via environment variable:

```bash
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
```

### Playback Audio Generation

When a transcription requires confirmation:

1. **Generate playback audio** using Amazon Polly
   - Text-to-speech in the detected language
   - Adds confirmation prefix in appropriate language
   - Stores audio in S3 with encryption

2. **Generate pre-signed URL** for client access
   - URL expires in 1 hour (3600 seconds)
   - Allows client to play audio without authentication

3. **Update job status** to `confirming`
   - Includes playback URL and format
   - Sets `needsConfirmation: true`

### User Confirmation Flow

#### Accept Scenario

When user confirms (`confirmed: true`):

1. **Use final transcription**
   - Original transcription OR edited version
   - Edited text takes precedence if provided

2. **Extract clinical entities**
   - Call Clinical Extractor with Bedrock
   - Validate extracted entities
   - Calculate confidence scores

3. **Store structured data** in S3
   - Save to `transcriptions/{jobId}/structured-data.json`
   - Include metadata and validation results

4. **Trigger FHIR transformation** (if applicable)
   - Build FHIR payload from entities
   - Invoke FHIR Transformer Lambda asynchronously
   - Non-blocking (errors logged but don't fail job)

5. **Update job status** to `completed`
   - Include entity confidence scores
   - Record confirmation timestamp

#### Reject Scenario

When user rejects (`confirmed: false`):

1. **Update job status** to `rejected`
   - Record rejection timestamp
   - Add rejection reason

2. **No further processing**
   - Clinical extraction skipped
   - FHIR transformation skipped

3. **Client should prompt re-recording**
   - User can create new voice job
   - Original job remains in rejected state

### Edited Transcription

Users can edit the transcription before confirming:

```json
{
  "jobId": "voice-job-123",
  "confirmed": true,
  "editedTranscription": "Patient has high fever for three days"
}
```

**Behavior:**

- Edited text replaces original transcription
- Clinical extraction uses edited version
- Original transcription preserved in job metadata
- Useful for correcting minor errors without re-recording

## DynamoDB Schema Updates

### VoiceJobs Table Fields

**Confirmation-related fields:**

```typescript
{
  // Confirmation workflow
  needsConfirmation?: boolean;
  playbackAudioS3Key?: string;
  playbackAudioUrl?: string;
  playbackAudioFormat?: string;
  playbackAudioGenerated?: boolean;
  playbackAudioError?: string;

  // User decision
  confirmed?: boolean;
  finalTranscription?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Entity extraction results
  structuredData?: object;
  entityConfidence?: number;
  entityConfidenceByType?: object;
  validationWarnings?: string[];
}
```

## Client Integration

### Polling for Status

Client should poll `GET /api/v1/voice/{jobId}` until status changes:

```javascript
async function pollJobStatus(jobId) {
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`/api/v1/voice/${jobId}`);
    const job = await response.json();

    if (job.status === 'confirming') {
      // Show confirmation UI
      return showConfirmationUI(job);
    }

    if (job.status === 'completed') {
      // Show success
      return showSuccess(job);
    }

    if (job.status === 'failed' || job.status === 'rejected') {
      // Show error
      return showError(job);
    }

    // Still processing, wait and retry
    await sleep(5000);
    attempts++;
  }

  throw new Error('Polling timeout');
}
```

### Confirmation UI

When `status === 'confirming'`:

```javascript
function showConfirmationUI(job) {
  // 1. Display transcription text
  displayTranscription(job.transcription);

  // 2. Play audio if available
  if (job.playbackAudioUrl) {
    const audio = new Audio(job.playbackAudioUrl);
    audio.play();
  }

  // 3. Show confidence score
  displayConfidence(job.transcriptionConfidence);

  // 4. Provide edit capability
  const editableText = createEditableField(job.transcription);

  // 5. Confirm/Reject buttons
  showButtons({
    onConfirm: () => confirmTranscription(job.jobId, editableText.value),
    onReject: () => rejectTranscription(job.jobId),
  });
}
```

### Submitting Confirmation

```javascript
async function confirmTranscription(jobId, editedText) {
  const response = await fetch(`/api/v1/voice/${jobId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      confirmed: true,
      editedTranscription: editedText !== originalText ? editedText : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('Confirmation failed');
  }

  const result = await response.json();
  return result;
}

async function rejectTranscription(jobId) {
  const response = await fetch(`/api/v1/voice/${jobId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      confirmed: false,
    }),
  });

  if (!response.ok) {
    throw new Error('Rejection failed');
  }

  // Prompt user to re-record
  showReRecordPrompt();
}
```

## Environment Variables

```bash
# Enable/disable confirmation workflow
ENABLE_PLAYBACK_CONFIRMATION=true

# Confidence threshold for routing to confirmation
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75

# DynamoDB table
VOICEJOBS_TABLE=VoiceJobs

# S3 bucket for audio storage
S3_AUDIO_BUCKET=vaidyalink-audio

# FHIR Transformer Lambda ARN
FHIR_TRANSFORMER_LAMBDA_ARN=arn:aws:lambda:us-east-1:123456789012:function:fhir-transformer

# Bedrock model for clinical extraction
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

## Error Handling

### Playback Audio Generation Failure

If audio generation fails:

- Job still routes to confirmation
- `playbackAudioGenerated: false`
- `playbackAudioError` contains error message
- User can still confirm without hearing audio

### Clinical Extraction Failure

If entity extraction fails after confirmation:

- Job marked as `failed`
- Error message stored in `errorMessage` field
- Client receives 500 error response
- User can retry or contact support

### FHIR Transformation Failure

If FHIR transformation fails:

- Error logged but job still completes
- Voice processing succeeds
- FHIR resources not created
- Retry mechanism can be implemented separately

## Testing

Run tests:

```bash
cd backend/voice-processing
npm test -- confirmation-workflow.test.js
```

Test coverage:

- ✅ User accepts transcription
- ✅ User rejects transcription
- ✅ Edited transcription handling
- ✅ FHIR transformation trigger
- ✅ Input validation
- ✅ State validation
- ✅ Error handling
- ✅ Job status polling

## Monitoring

### CloudWatch Metrics

Track confirmation workflow metrics:

- `ConfirmationRequired` - Count of jobs requiring confirmation
- `ConfirmationAccepted` - Count of accepted confirmations
- `ConfirmationRejected` - Count of rejected confirmations
- `ConfirmationLatency` - Time from confirming to completed
- `PlaybackAudioGenerationFailures` - Audio generation errors

### CloudWatch Logs

Log events:

```
[INFO] Job voice-job-123 awaiting user confirmation
[INFO] Playback audio generated successfully: s3://bucket/playback/job-123/confirmation.mp3
[INFO] User confirmed transcription for job voice-job-123
[INFO] User rejected transcription for job voice-job-123
[ERROR] Failed to generate playback audio: Polly API timeout
[ERROR] Clinical extraction failed for job voice-job-123: Bedrock API error
```

## Best Practices

1. **Always provide playback audio** when possible
   - Helps users verify transcription accuracy
   - Especially important for non-literate users

2. **Allow transcription editing**
   - Minor corrections avoid re-recording
   - Faster workflow for users

3. **Set appropriate confidence threshold**
   - Too low: unnecessary confirmations
   - Too high: inaccurate data accepted
   - Monitor and adjust based on accuracy metrics

4. **Handle errors gracefully**
   - Audio generation failure shouldn't block confirmation
   - FHIR transformation failure shouldn't fail voice processing

5. **Provide clear UI feedback**
   - Show confidence score to user
   - Explain why confirmation is needed
   - Make edit functionality obvious

## Related Documentation

- [Bhashini Integration](./BHASHINI_INTEGRATION.md)
- [Clinical Entity Extraction](./CLINICAL_EXTRACTION.md)
- [Playback Audio Generation](./PLAYBACK_AUDIO_GENERATION.md)
- [FHIR Observation Mapping](./FHIR_OBSERVATION_MAPPING.md)

## Task Completion

Task 10.7 is complete when:

- ✅ `processConfirmation` handler implemented
- ✅ `getJobStatus` handler implemented
- ✅ State transitions working correctly
- ✅ Edited transcription support added
- ✅ FHIR transformation triggered on accept
- ✅ Comprehensive tests passing
- ✅ Documentation complete
