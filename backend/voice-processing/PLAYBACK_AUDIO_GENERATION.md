# Playback Audio Generation

This document describes the playback audio generation feature for voice transcription confirmation in VaidyaLink.

## Overview

The playback audio generation feature converts transcribed text back into speech using Amazon Polly, allowing users to hear and confirm their voice recordings. This is particularly important for:

- Low-confidence transcriptions (below 75% confidence threshold)
- Non-literate users who cannot read transcriptions
- Multilingual support across 22 Indian languages
- Medical safety through human-in-the-loop verification

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Voice Processing Flow                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Bhashini API    │
                    │  Transcription   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Confidence Check │
                    │   < 75% ?        │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   Yes                 No
                    │                   │
                    ▼                   ▼
          ┌──────────────────┐   ┌──────────────┐
          │  Amazon Polly    │   │   Continue   │
          │ Text-to-Speech   │   │  Processing  │
          └──────────────────┘   └──────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │   Upload to S3   │
          │  Generate URL    │
          └──────────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │  User Playback   │
          │  & Confirmation  │
          └──────────────────┘
```

## Features

### 1. Multilingual Text-to-Speech

Supports all 22 scheduled Indian languages:

- English (en-IN) - Neural voice
- Hindi (hi-IN) - Neural voice
- Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu (fallback to English with Indian accent)

### 2. Automatic Confirmation Prefix

Adds language-appropriate confirmation prompts:

- English: "Please confirm if this is correct:"
- Hindi: "कृपया पुष्टि करें कि यह सही है:"
- Tamil: "இது சரியானதா என்பதை உறுதிப்படுத்தவும்:"
- And more for all supported languages

### 3. Audio Optimization

- Format: MP3 (configurable to OGG Vorbis or PCM)
- Sample Rate: 22.05 kHz (optimal for speech)
- Neural voices for natural-sounding speech
- Automatic text truncation for long transcriptions

### 4. Secure Storage

- Encrypted storage in S3 using AWS KMS
- Pre-signed URLs with 1-hour expiration
- Organized storage structure: `playback/{jobId}/confirmation.mp3`

## Usage

### Basic Usage

```javascript
const { createAudioGenerator } = require('./utils/audio-generator');

// Initialize generator
const audioGenerator = createAudioGenerator({
  region: 'us-east-1',
  s3Bucket: 'vaidyalink-audio',
  outputFormat: 'mp3',
  sampleRate: '22050',
});

// Generate playback audio
const result = await audioGenerator.generatePlaybackAudio(
  'Patient has fever and headache for 3 days',
  'en',
  'job-123'
);

console.log('Audio URL:', result.s3Url);
console.log('Playback URL:', await audioGenerator.generatePresignedUrl(result.s3Key));
```

### Integration in Voice Processing Lambda

The audio generator is automatically invoked when:

1. Transcription confidence is below threshold (default: 75%)
2. `ENABLE_PLAYBACK_CONFIRMATION` environment variable is set to `true`

```javascript
// Automatic integration in processVoiceRecording()
if (needsConfirmation) {
  const audioResult = await audioGenerator.generatePlaybackAudio(
    transcription,
    detectedLanguage,
    jobId
  );

  const playbackUrl = await audioGenerator.generatePresignedUrl(audioResult.s3Key, 3600);

  // Update job with playback URL
  await updateJobStatus(jobId, 'confirming', {
    playbackAudioUrl: playbackUrl,
    needsConfirmation: true,
  });
}
```

## Configuration

### Environment Variables

```bash
# Enable playback confirmation
ENABLE_PLAYBACK_CONFIRMATION=true

# Confidence threshold for triggering confirmation
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75

# Audio format (mp3, ogg_vorbis, pcm)
AUDIO_OUTPUT_FORMAT=mp3

# Sample rate (8000, 16000, 22050, 24000)
AUDIO_SAMPLE_RATE=22050

# S3 bucket for audio storage
S3_AUDIO_BUCKET=vaidyalink-audio

# AWS region
AWS_REGION=us-east-1
```

### IAM Permissions

The Lambda function requires the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::vaidyalink-audio/playback/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:*:*:key/*"
    }
  ]
}
```

## API Response Format

### Successful Generation

```json
{
  "success": true,
  "s3Url": "s3://vaidyalink-audio/playback/job-123/confirmation.mp3",
  "s3Key": "playback/job-123/confirmation.mp3",
  "s3Bucket": "vaidyalink-audio",
  "format": "mp3",
  "sampleRate": "22050",
  "language": "en",
  "voiceId": "Kajal",
  "textLength": 45,
  "audioSize": 12345,
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Job Status Update

```json
{
  "jobId": "job-123",
  "status": "confirming",
  "transcription": "Patient has fever and headache",
  "transcriptionConfidence": 0.72,
  "detectedLanguage": "en",
  "needsConfirmation": true,
  "playbackAudioS3Key": "playback/job-123/confirmation.mp3",
  "playbackAudioUrl": "https://vaidyalink-audio.s3.amazonaws.com/playback/...",
  "playbackAudioFormat": "mp3",
  "playbackAudioGenerated": true,
  "transcribedAt": "2024-01-15T10:30:00.000Z"
}
```

## Voice Selection

### Amazon Polly Voices

| Language | Voice ID | Engine   | Language Code |
| -------- | -------- | -------- | ------------- |
| English  | Kajal    | Neural   | en-IN         |
| Hindi    | Kajal    | Neural   | hi-IN         |
| Others   | Kajal    | Standard | en-IN         |

**Note**: Amazon Polly currently has limited native support for Indian languages. For languages without native support, the system uses Indian English with appropriate confirmation prefixes in the target language.

### Future Enhancements

- Integration with Bhashini TTS API for native Indian language voices
- Custom voice models trained on medical terminology
- Gender-specific voice selection
- Speech rate and pitch customization

## Error Handling

### Graceful Degradation

If audio generation fails, the system continues with text-only confirmation:

```javascript
try {
  const audioResult = await audioGenerator.generatePlaybackAudio(...);
  // Success - include playback URL
} catch (audioError) {
  console.error('Failed to generate playback audio:', audioError);

  // Continue without audio - user can still read transcription
  await updateJobStatus(jobId, 'confirming', {
    playbackAudioGenerated: false,
    playbackAudioError: audioError.message,
  });
}
```

### Common Errors

1. **Polly API Errors**
   - Throttling: Implement exponential backoff
   - Invalid text: Validate and sanitize input
   - Unsupported language: Fallback to English

2. **S3 Upload Errors**
   - Permission denied: Check IAM policies
   - Bucket not found: Verify bucket configuration
   - KMS errors: Ensure key access

3. **Text Length Errors**
   - Automatic truncation at 2500 characters
   - Warning logged for truncated text

## Testing

### Unit Tests

```bash
cd backend/voice-processing
npm test -- audio-generator.test.js
```

### Integration Test

```javascript
const { createAudioGenerator } = require('./utils/audio-generator');

async function testAudioGeneration() {
  const generator = createAudioGenerator();

  const result = await generator.generatePlaybackAudio(
    'मरीज को बुखार और सिरदर्द है',
    'hi',
    'test-job-123'
  );

  console.log('Generated audio:', result);

  const playbackUrl = await generator.generatePresignedUrl(result.s3Key);
  console.log('Playback URL:', playbackUrl);
}

testAudioGeneration();
```

## Performance Considerations

### Latency

- Polly synthesis: ~1-2 seconds for typical transcriptions
- S3 upload: ~500ms for MP3 files
- Pre-signed URL generation: <100ms
- **Total overhead**: ~2-3 seconds

### Cost Optimization

- Use standard voices for non-critical languages (lower cost)
- Cache frequently used phrases
- Implement request throttling
- Monitor Polly character usage

### Polly Pricing (as of 2024)

- Neural voices: $16 per 1 million characters
- Standard voices: $4 per 1 million characters
- Average transcription: 100-200 characters
- **Cost per playback**: ~$0.0016 (neural) or ~$0.0004 (standard)

## Monitoring

### CloudWatch Metrics

```javascript
// Custom metrics to track
-AudioGenerationSuccess -
  AudioGenerationFailure -
  AudioGenerationLatency -
  PollyCharactersProcessed -
  S3UploadLatency;
```

### Logging

```javascript
console.log('Generating playback audio', {
  jobId,
  language,
  textLength,
  voiceId,
  format,
});

console.log('Playback audio generated', {
  jobId,
  audioSize,
  duration,
  s3Key,
});
```

## Security

### Data Protection

- All audio files encrypted at rest using AWS KMS
- Pre-signed URLs expire after 1 hour
- No PHI in audio file metadata
- Audit logging via CloudTrail

### Access Control

- S3 bucket policies restrict access to Lambda role
- Pre-signed URLs use temporary credentials
- No public access to audio files

## Compliance

### HIPAA Considerations

- Audio files contain PHI (Protected Health Information)
- Encrypted storage and transmission required
- Audit trail for all access
- Retention policies aligned with HIPAA requirements

### ABDM Compliance

- Audio confirmation supports consent management
- Playback enables informed consent
- Multilingual support meets accessibility requirements

## Troubleshooting

### Audio Not Generated

1. Check `ENABLE_PLAYBACK_CONFIRMATION` is set to `true`
2. Verify transcription confidence is below threshold
3. Check CloudWatch logs for Polly errors
4. Verify IAM permissions for Polly and S3

### Poor Audio Quality

1. Increase sample rate to 24000 Hz
2. Use neural voices instead of standard
3. Check for text encoding issues
4. Verify language-voice mapping

### Playback URL Expired

1. Generate new pre-signed URL
2. Increase expiration time (default: 3600s)
3. Implement URL refresh mechanism in frontend

## Related Documentation

- [Bhashini Integration](./BHASHINI_INTEGRATION.md)
- [Clinical Extraction](./CLINICAL_EXTRACTION.md)
- [Voice Processing Lambda](./README.md)
- [S3 Audio Handling](./S3_AUDIO_HANDLING.md)
