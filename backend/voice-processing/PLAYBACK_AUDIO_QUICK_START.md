# Playback Audio Generation - Quick Start

Get started with playback audio generation for voice transcription confirmation in 5 minutes.

## What is Playback Audio Generation?

Converts transcribed text back into speech using Amazon Polly, allowing users to hear and confirm their voice recordings. Automatically triggered for low-confidence transcriptions.

## Prerequisites

- AWS account with Polly access
- S3 bucket for audio storage
- IAM permissions configured
- Node.js 18+ environment

## Quick Setup

### 1. Install Dependencies

```bash
cd backend/voice-processing
npm install @aws-sdk/client-polly @aws-sdk/s3-request-presigner
```

### 2. Configure Environment Variables

```bash
# Enable playback confirmation
export ENABLE_PLAYBACK_CONFIRMATION=true

# Confidence threshold (0.0 - 1.0)
export TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75

# Audio settings
export AUDIO_OUTPUT_FORMAT=mp3
export AUDIO_SAMPLE_RATE=22050

# AWS configuration
export S3_AUDIO_BUCKET=vaidyalink-audio
export AWS_REGION=us-east-1
```

### 3. Set Up IAM Permissions

Add to your Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": ["polly:SynthesizeSpeech", "s3:PutObject", "s3:GetObject"],
  "Resource": "*"
}
```

## Basic Usage

### Generate Playback Audio

```javascript
const { createAudioGenerator } = require('./utils/audio-generator');

// Initialize
const audioGenerator = createAudioGenerator();

// Generate audio
const result = await audioGenerator.generatePlaybackAudio(
  'Patient has fever and headache',
  'en',
  'job-123'
);

console.log('Audio generated:', result.s3Url);

// Get playback URL
const playbackUrl = await audioGenerator.generatePresignedUrl(result.s3Key);
console.log('Playback URL:', playbackUrl);
```

### Automatic Integration

The audio generator is automatically invoked in the voice processing pipeline:

```javascript
// In processVoiceRecording()
if (confidence < TRANSCRIPTION_CONFIDENCE_THRESHOLD) {
  // Audio generation happens automatically
  // Job status updated with playback URL
}
```

## Test It

### 1. Create Test Voice Job

```bash
# Upload test audio file
aws s3 cp test-audio.wav s3://vaidyalink-audio/audio/patient-123/job-456/recording.wav

# Create DynamoDB record
aws dynamodb put-item \
  --table-name VoiceJobs \
  --item '{
    "PK": {"S": "VOICE#job-456"},
    "SK": {"S": "METADATA"},
    "jobId": {"S": "job-456"},
    "patientId": {"S": "patient-123"},
    "status": {"S": "pending"},
    "audioS3Key": {"S": "audio/patient-123/job-456/recording.wav"},
    "language": {"S": "en"}
  }'
```

### 2. Trigger Processing

```bash
# Invoke Lambda
aws lambda invoke \
  --function-name voice-processing \
  --payload '{"jobId": "job-456"}' \
  response.json

cat response.json
```

### 3. Check Results

```bash
# Check job status
aws dynamodb get-item \
  --table-name VoiceJobs \
  --key '{"PK": {"S": "VOICE#job-456"}, "SK": {"S": "METADATA"}}'

# Download playback audio
aws s3 cp s3://vaidyalink-audio/playback/job-456/confirmation.mp3 ./playback.mp3

# Play audio
mpg123 playback.mp3  # Linux/Mac
# or open in browser
```

## Supported Languages

| Language | Code | Voice          | Example Prefix                            |
| -------- | ---- | -------------- | ----------------------------------------- |
| English  | en   | Kajal (Neural) | "Please confirm if this is correct:"      |
| Hindi    | hi   | Kajal (Neural) | "कृपया पुष्टि करें कि यह सही है:"         |
| Tamil    | ta   | Kajal          | "இது சரியானதா என்பதை உறுதிப்படுத்தவும்:"  |
| Bengali  | bn   | Kajal          | "অনুগ্রহ করে নিশ্চিত করুন এটি সঠিক কিনা:" |

[See full list in PLAYBACK_AUDIO_GENERATION.md]

## Configuration Options

### Audio Format

```bash
# MP3 (default, best compatibility)
export AUDIO_OUTPUT_FORMAT=mp3

# OGG Vorbis (smaller size)
export AUDIO_OUTPUT_FORMAT=ogg_vorbis

# PCM (highest quality)
export AUDIO_OUTPUT_FORMAT=pcm
```

### Sample Rate

```bash
# 22.05 kHz (default, optimal for speech)
export AUDIO_SAMPLE_RATE=22050

# 16 kHz (smaller size)
export AUDIO_SAMPLE_RATE=16000

# 24 kHz (higher quality)
export AUDIO_SAMPLE_RATE=24000
```

### Confidence Threshold

```bash
# Default: 75%
export TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75

# More strict: 85%
export TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.85

# Less strict: 65%
export TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.65
```

## Common Use Cases

### 1. Low-Confidence Transcription

```javascript
// Automatic playback for confidence < 75%
const transcription = await transcribeAudio(audioData, 'hi');
// confidence = 0.68

// Audio automatically generated
// User receives playback URL for confirmation
```

### 2. Non-Literate User Support

```javascript
// Always enable playback for specific users
if (user.preferredConfirmationMethod === 'audio') {
  const audioResult = await audioGenerator.generatePlaybackAudio(
    transcription,
    user.language,
    jobId
  );
}
```

### 3. Multilingual Confirmation

```javascript
// Generate audio in user's preferred language
const languages = ['en', 'hi', 'ta', 'bn'];

for (const lang of languages) {
  const audio = await audioGenerator.generatePlaybackAudio(transcription, lang, `${jobId}-${lang}`);
}
```

## Troubleshooting

### Audio Not Generated

**Problem**: No playback audio created

**Solutions**:

```bash
# 1. Check if feature is enabled
echo $ENABLE_PLAYBACK_CONFIRMATION  # Should be "true"

# 2. Check confidence threshold
# Audio only generated if confidence < threshold

# 3. Check CloudWatch logs
aws logs tail /aws/lambda/voice-processing --follow
```

### Polly API Errors

**Problem**: "AccessDeniedException" from Polly

**Solution**:

```bash
# Add Polly permissions to Lambda role
aws iam attach-role-policy \
  --role-name voice-processing-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonPollyReadOnlyAccess
```

### S3 Upload Fails

**Problem**: "Access Denied" when uploading to S3

**Solution**:

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket vaidyalink-audio

# Add Lambda role to bucket policy
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::ACCOUNT:role/voice-processing-role"
  },
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::vaidyalink-audio/playback/*"
}
```

## Testing

### Run Unit Tests

```bash
npm test -- audio-generator.test.js
```

### Manual Test

```javascript
// test-audio-generation.js
const { createAudioGenerator } = require('./src/utils/audio-generator');

async function test() {
  const generator = createAudioGenerator();

  const result = await generator.generatePlaybackAudio('मरीज को बुखार है', 'hi', 'test-123');

  console.log('Success:', result);

  const url = await generator.generatePresignedUrl(result.s3Key);
  console.log('Play at:', url);
}

test().catch(console.error);
```

```bash
node test-audio-generation.js
```

## Performance

- **Generation time**: ~2-3 seconds
- **Audio size**: ~10-50 KB for typical transcriptions
- **Cost**: ~$0.0016 per playback (neural voice)

## Next Steps

1. **Customize voices**: Explore different Polly voices
2. **Add caching**: Cache common phrases to reduce costs
3. **Implement feedback**: Track user confirmation rates
4. **Monitor usage**: Set up CloudWatch dashboards

## Related Documentation

- [Full Documentation](./PLAYBACK_AUDIO_GENERATION.md)
- [Voice Processing](./README.md)
- [Bhashini Integration](./BHASHINI_INTEGRATION.md)
- [Clinical Extraction](./CLINICAL_EXTRACTION.md)

## Support

For issues or questions:

- Check CloudWatch logs: `/aws/lambda/voice-processing`
- Review IAM permissions
- Verify environment variables
- Test with simple English text first
