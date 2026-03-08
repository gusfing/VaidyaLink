# Bhashini Integration Quick Start

## Overview

Get started with Bhashini API integration for multilingual voice transcription in 5 minutes.

## Prerequisites

- AWS Account with Lambda access
- Bhashini API credentials (API Key, User ID, Service ID)
- Node.js 18+ for local testing

## Step 1: Obtain Bhashini Credentials

1. Visit [Bhashini Portal](https://bhashini.gov.in/)
2. Register and create an application
3. Note down:
   - API Key
   - User ID
   - ASR Service ID

## Step 2: Configure Environment Variables

Create `.env` file in `backend/voice-processing/`:

```bash
# Bhashini API Configuration
BHASHINI_API_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline
BHASHINI_API_KEY=your-api-key-here
BHASHINI_USER_ID=your-user-id-here
BHASHINI_ASR_SERVICE_ID=your-service-id-here

# AWS Configuration
S3_AUDIO_BUCKET=vaidyalink-audio-dev
VOICEJOBS_TABLE=vaidyalink-voice-jobs-dev

# Transcription Settings
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
ENABLE_PLAYBACK_CONFIRMATION=true
SUPPORTED_LANGUAGES=en,hi,bn,te,mr,ta,gu,kn,ml,pa
```

## Step 3: Install Dependencies

```bash
cd backend/voice-processing
npm install
```

## Step 4: Test Locally

### Create Test Audio File

```bash
# Create a test WAV file (16kHz, mono)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" \
  -ar 16000 -ac 1 test-audio.wav
```

### Run Test

```javascript
// test-bhashini.js
const fs = require('fs');
const axios = require('axios');

async function testBhashini() {
  const audioData = fs.readFileSync('test-audio.wav');
  const audioBase64 = audioData.toString('base64');

  const response = await axios.post(
    process.env.BHASHINI_API_URL,
    {
      pipelineTasks: [
        {
          taskType: 'asr',
          config: {
            language: { sourceLanguage: 'hi' },
            serviceId: process.env.BHASHINI_ASR_SERVICE_ID,
            audioFormat: 'wav',
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [{ audioContent: audioBase64 }],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.BHASHINI_API_KEY,
        userID: process.env.BHASHINI_USER_ID,
      },
    }
  );

  console.log('Transcription:', response.data.pipelineResponse[0].output[0].source);
  console.log('Confidence:', response.data.pipelineResponse[0].config.confidence);
}

testBhashini();
```

```bash
node test-bhashini.js
```

## Step 5: Deploy Lambda

### Update Lambda Environment Variables

```bash
aws lambda update-function-configuration \
  --function-name vaidyalink-voice-processing-dev \
  --environment Variables="{
    BHASHINI_API_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline,
    BHASHINI_API_KEY=your-api-key,
    BHASHINI_USER_ID=your-user-id,
    BHASHINI_ASR_SERVICE_ID=your-service-id,
    S3_AUDIO_BUCKET=vaidyalink-audio-dev,
    VOICEJOBS_TABLE=vaidyalink-voice-jobs-dev,
    TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
  }"
```

### Deploy Lambda Code

```bash
# Build and deploy
npm run build
aws lambda update-function-code \
  --function-name vaidyalink-voice-processing-dev \
  --zip-file fileb://dist/lambda.zip
```

## Step 6: Test End-to-End

### Upload Audio via API

```bash
# Get pre-signed URL
curl -X POST https://api.vaidyalink.com/api/v1/voice/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-123",
    "language": "hi",
    "fileName": "recording.wav"
  }'

# Upload audio to S3 using pre-signed URL
curl -X PUT "$PRESIGNED_URL" \
  --upload-file recording.wav \
  -H "Content-Type: audio/wav"

# Check transcription status
curl -X GET https://api.vaidyalink.com/api/v1/voice/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response

```json
{
  "jobId": "voice-job-123",
  "status": "completed",
  "transcription": "मुझे सिरदर्द है और बुखार है",
  "transcriptionConfidence": 0.92,
  "detectedLanguage": "hi",
  "structuredData": {
    "chiefComplaint": "Headache and fever",
    "symptoms": ["headache", "fever"],
    "severity": "moderate"
  }
}
```

## Common Issues

### Issue: 401 Unauthorized

**Solution**: Verify API key and User ID are correct

```bash
# Test credentials
curl -X POST https://dhruva-api.bhashini.gov.in/services/inference/pipeline \
  -H "Authorization: $BHASHINI_API_KEY" \
  -H "userID: $BHASHINI_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"pipelineTasks":[]}'
```

### Issue: Low Confidence Scores

**Solution**: Improve audio quality

```bash
# Check audio properties
ffprobe recording.wav

# Convert to required format
ffmpeg -i input.mp3 -ar 16000 -ac 1 -f wav output.wav
```

### Issue: Empty Transcription

**Solution**: Check audio contains speech

```bash
# Verify audio is not silent
ffmpeg -i recording.wav -af "volumedetect" -f null /dev/null
```

## Supported Languages

Quick reference for language codes:

| Language | Code | Example                |
| -------- | ---- | ---------------------- |
| English  | en   | "I have a headache"    |
| Hindi    | hi   | "मुझे सिरदर्द है"      |
| Bengali  | bn   | "আমার মাথাব্যথা আছে"   |
| Tamil    | ta   | "எனக்கு தலைவலி உள்ளது" |
| Telugu   | te   | "నాకు తలనొప్పి ఉంది"   |

[See full list in BHASHINI_INTEGRATION.md](./BHASHINI_INTEGRATION.md#supported-languages)

## Next Steps

1. **Review Full Documentation**: [BHASHINI_INTEGRATION.md](./BHASHINI_INTEGRATION.md)
2. **Run Tests**: `npm test -- bhashini-integration.test.js`
3. **Monitor Performance**: Check CloudWatch metrics
4. **Optimize Costs**: Implement caching and batch processing

## Resources

- [Bhashini Documentation](https://bhashini.gov.in/documentation)
- [Voice Processing Lambda Code](./src/index.js)
- [Integration Tests](./src/__tests__/bhashini-integration.test.js)

## Support

- Bhashini API: support@bhashini.gov.in
- VaidyaLink: dev@vaidyalink.com
