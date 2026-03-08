# S3 Audio File Handling Guide

## Overview

This guide covers the S3 audio file handling implementation in the Voice Processing Lambda. The system handles audio file downloads, validation, metadata extraction, and error recovery for voice recordings stored in S3.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Upload)   │
└──────┬──────┘
       │ Pre-signed URL
       ▼
┌─────────────┐
│     S3      │
│   Bucket    │
└──────┬──────┘
       │ S3 Event Notification
       ▼
┌─────────────┐
│   Voice     │
│ Processing  │
│   Lambda    │
└─────────────┘
```

## S3 Bucket Structure

```
vaidyalink-audio-{env}/
├── audio/
│   ├── {patientId}/
│   │   ├── {jobId}/
│   │   │   ├── recording.wav          # Original audio file
│   │   │   └── metadata.json          # Audio metadata
├── transcriptions/
│   ├── {jobId}/
│   │   ├── transcription.json         # Transcription result
│   │   └── structured-data.json       # Structured clinical data
└── playback/
    ├── {jobId}/
    │   └── confirmation.mp3           # Playback audio for confirmation
```

## Audio File Download

### Implementation

The `downloadAudioFromS3` function handles secure audio file retrieval:

```javascript
async function downloadAudioFromS3(bucket, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];

    // Stream audio data
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error downloading audio from S3:', error);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}
```

### Features

- **Streaming**: Handles large audio files efficiently
- **Error Handling**: Comprehensive error messages
- **Memory Efficient**: Chunks processed incrementally
- **Secure**: Uses AWS SDK v3 with IAM role authentication

### Error Scenarios

| Error Code         | Description              | Resolution                       |
| ------------------ | ------------------------ | -------------------------------- |
| NoSuchKey          | Audio file not found     | Verify S3 key in DynamoDB record |
| AccessDenied       | Insufficient permissions | Check Lambda IAM role            |
| InvalidObjectState | Object in Glacier        | Restore object before processing |
| RequestTimeout     | Network timeout          | Retry with exponential backoff   |

## S3 Event Processing

### Event Structure

```json
{
  "Records": [
    {
      "eventVersion": "2.1",
      "eventSource": "aws:s3",
      "awsRegion": "ap-south-1",
      "eventTime": "2024-01-15T10:30:00.000Z",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "vaidyalink-audio-prod",
          "arn": "arn:aws:s3:::vaidyalink-audio-prod"
        },
        "object": {
          "key": "audio/patient-123/voice-job-456/recording.wav",
          "size": 524288,
          "eTag": "d41d8cd98f00b204e9800998ecf8427e"
        }
      }
    }
  ]
}
```

### Processing Flow

1. **Event Reception**: Lambda triggered by S3 ObjectCreated event
2. **Key Parsing**: Extract patientId and jobId from S3 key
3. **Status Update**: Mark job as "transcribing" in DynamoDB
4. **Download**: Retrieve audio file from S3
5. **Validation**: Check audio format and quality
6. **Processing**: Transcribe and structure data
7. **Completion**: Update job status and save results

### Implementation

```javascript
async function processS3Event(record) {
  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;

  console.log(`Processing S3 audio file: s3://${bucket}/${key}`);

  // Extract job ID from S3 key (format: audio/{patientId}/{jobId}/recording.wav)
  const parts = key.split('/');
  if (parts.length < 3) {
    throw new Error(`Invalid S3 key format: ${key}`);
  }

  const patientId = parts[1];
  const jobId = parts[2];

  try {
    // Update job status to processing
    await updateJobStatus(jobId, 'transcribing', {
      processingStartedAt: new Date().toISOString(),
    });

    // Process the voice recording
    await processVoiceRecording(jobId, bucket, key);
  } catch (error) {
    console.error(`Error processing S3 event for job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed', {
      errorMessage: error.message,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
}
```

## Audio File Validation

### Format Requirements

- **Container**: WAV (RIFF)
- **Codec**: PCM (uncompressed)
- **Sample Rate**: 16 kHz (recommended), 8-48 kHz supported
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit
- **Duration**: 5 seconds to 2 minutes
- **File Size**: Maximum 10 MB

### Validation Implementation

```javascript
async function validateAudioFile(audioBuffer) {
  // Check file size
  if (audioBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Audio file exceeds maximum size of 10 MB');
  }

  if (audioBuffer.length < 1024) {
    throw new Error('Audio file too small, minimum 1 KB required');
  }

  // Check WAV header
  const header = audioBuffer.slice(0, 44);
  const riffHeader = header.slice(0, 4).toString('ascii');

  if (riffHeader !== 'RIFF') {
    throw new Error('Invalid audio format: Expected WAV file');
  }

  // Extract audio metadata
  const channels = header.readUInt16LE(22);
  const sampleRate = header.readUInt32LE(24);
  const bitsPerSample = header.readUInt16LE(34);

  // Validate audio parameters
  if (channels !== 1) {
    console.warn(`Audio has ${channels} channels, mono recommended`);
  }

  if (sampleRate < 8000 || sampleRate > 48000) {
    throw new Error(`Invalid sample rate: ${sampleRate} Hz (8-48 kHz required)`);
  }

  if (bitsPerSample !== 16) {
    console.warn(`Audio has ${bitsPerSample}-bit depth, 16-bit recommended`);
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    fileSize: audioBuffer.length,
  };
}
```

## Saving Results to S3

### Transcription Storage

```javascript
async function saveTranscription(jobId, transcription, confidence, detectedLanguage) {
  try {
    const key = `transcriptions/${jobId}/transcription.json`;

    const data = {
      jobId,
      transcription,
      confidence,
      detectedLanguage,
      transcribedAt: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: S3_AUDIO_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
    });

    await s3Client.send(command);

    console.log(`Transcription saved to s3://${S3_AUDIO_BUCKET}/${key}`);
  } catch (error) {
    console.error('Error saving transcription to S3:', error);
    throw error;
  }
}
```

### Structured Data Storage

```javascript
async function saveStructuredData(jobId, structuredData) {
  try {
    const key = `transcriptions/${jobId}/structured-data.json`;

    const data = {
      jobId,
      structuredData,
      structuredAt: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: S3_AUDIO_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
    });

    await s3Client.send(command);

    console.log(`Structured data saved to s3://${S3_AUDIO_BUCKET}/${key}`);
  } catch (error) {
    console.error('Error saving structured data to S3:', error);
    throw error;
  }
}
```

## Security

### Encryption

- **At Rest**: S3 server-side encryption with AWS KMS
- **In Transit**: TLS 1.3 for all S3 operations
- **Key Management**: Customer-managed KMS keys

### IAM Permissions

Required Lambda execution role permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::vaidyalink-audio-*/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": ["arn:aws:kms:*:*:key/*"]
    }
  ]
}
```

### Access Control

- **Bucket Policy**: Deny unencrypted uploads
- **Object ACL**: Private (no public access)
- **Versioning**: Enabled for audit trail
- **Lifecycle**: Auto-delete after 90 days

## Performance Optimization

### Streaming vs Buffering

**Current Implementation**: Streaming with chunked reading

**Benefits**:

- Lower memory footprint
- Handles large files (up to 10 MB)
- Faster time-to-first-byte

**Trade-offs**:

- Slightly more complex code
- Requires async iteration

### Caching Strategy

Audio files are NOT cached because:

- One-time processing per file
- Large file sizes (memory constraints)
- Security (avoid storing PHI in memory)

## Monitoring

### CloudWatch Metrics

```javascript
// Custom metrics to track
const metrics = {
  S3DownloadLatency: downloadDuration,
  AudioFileSize: audioBuffer.length,
  S3DownloadErrors: errorCount,
  AudioValidationFailures: validationErrors,
};
```

### Logging

```javascript
// Structured logging for S3 operations
console.log(
  JSON.stringify({
    operation: 'downloadAudioFromS3',
    bucket,
    key,
    fileSize: audioBuffer.length,
    duration: downloadDuration,
    timestamp: new Date().toISOString(),
  })
);
```

## Error Handling

### Retry Strategy

```javascript
async function downloadWithRetry(bucket, key, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await downloadAudioFromS3(bucket, key);
    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error.name === 'NoSuchKey' || error.name === 'AccessDenied') {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Error Recovery

| Error Type         | Recovery Action                          |
| ------------------ | ---------------------------------------- |
| NoSuchKey          | Update job status to failed, notify user |
| AccessDenied       | Log security event, alert DevOps         |
| RequestTimeout     | Retry with exponential backoff           |
| ServiceUnavailable | Retry with backoff, use SQS DLQ          |
| InvalidObjectState | Restore from Glacier, reprocess          |

## Testing

### Unit Tests

```javascript
describe('downloadAudioFromS3', () => {
  it('should download audio file successfully', async () => {
    const mockAudioData = Buffer.from('mock audio data');

    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        async *[Symbol.asyncIterator]() {
          yield mockAudioData;
        },
      },
    });

    const result = await downloadAudioFromS3('test-bucket', 'test-key');
    expect(result).toEqual(mockAudioData);
  });

  it('should handle S3 errors', async () => {
    s3ClientMock.on(GetObjectCommand).rejects(new Error('NoSuchKey'));

    await expect(downloadAudioFromS3('test-bucket', 'invalid-key')).rejects.toThrow(
      'Failed to download audio'
    );
  });
});
```

### Integration Tests

```javascript
describe('S3 Event Processing', () => {
  it('should process S3 event and transcribe audio', async () => {
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'audio/patient-123/job-456/recording.wav' },
          },
        },
      ],
    };

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);
  });
});
```

## Best Practices

1. **Always validate audio format** before processing
2. **Use streaming** for large files
3. **Implement retry logic** with exponential backoff
4. **Log all S3 operations** for debugging
5. **Encrypt all data** at rest and in transit
6. **Set appropriate timeouts** (30 seconds recommended)
7. **Monitor file sizes** to prevent memory issues
8. **Clean up temporary files** after processing

## Troubleshooting

### Issue: Audio download fails

**Symptoms**: `NoSuchKey` error

**Solutions**:

1. Verify S3 key in DynamoDB matches actual file
2. Check S3 bucket name in environment variables
3. Verify Lambda has S3 read permissions

### Issue: Out of memory errors

**Symptoms**: Lambda crashes during download

**Solutions**:

1. Increase Lambda memory allocation
2. Verify audio file size < 10 MB
3. Check for memory leaks in processing code

### Issue: Slow downloads

**Symptoms**: Timeouts or high latency

**Solutions**:

1. Check S3 bucket region matches Lambda region
2. Verify network connectivity
3. Consider using S3 Transfer Acceleration

## Related Documentation

- [Voice Processing README](./README.md)
- [Bhashini Integration Guide](./BHASHINI_INTEGRATION.md)
- [S3 Pre-signed URLs Guide](../shared/S3_PRESIGNED_URLS_QUICK_START.md)

## Support

For issues with S3 audio handling:

- Check CloudWatch logs: `/aws/lambda/vaidyalink-voice-processing-{env}`
- Review X-Ray traces for performance issues
- Contact: dev@vaidyalink.com
