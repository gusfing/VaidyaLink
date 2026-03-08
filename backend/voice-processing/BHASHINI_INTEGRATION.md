# Bhashini API Integration Guide

## Overview

The Voice Processing Lambda integrates with **Bhashini API** (Government of India's multilingual AI platform) to provide speech-to-text transcription for 22 Indian languages. This enables non-literate patients to provide medical history through voice in their native language.

## What is Bhashini?

Bhashini (भाषिणी) is India's National Language Translation Mission platform that provides:

- **Automatic Speech Recognition (ASR)**: Speech-to-text in Indian languages
- **Neural Machine Translation (NMT)**: Translation between Indian languages
- **Text-to-Speech (TTS)**: Text-to-speech synthesis

For VaidyaLink, we use the ASR service for medical voice transcription.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Patient   │─────▶│  VaidyaLink  │─────▶│     S3      │
│   (Voice)   │      │   Frontend   │      │   (Audio)   │
└─────────────┘      └──────────────┘      └─────────────┘
                                                   │
                                                   │ S3 Event
                                                   ▼
                                            ┌─────────────┐
                                            │   Voice     │
                                            │ Processing  │
                                            │   Lambda    │
                                            └─────────────┘
                                                   │
                                                   │ HTTP POST
                                                   ▼
                                            ┌─────────────┐
                                            │  Bhashini   │
                                            │     API     │
                                            │    (ASR)    │
                                            └─────────────┘
                                                   │
                                                   │ Transcription
                                                   ▼
                                            ┌─────────────┐
                                            │   Amazon    │
                                            │   Bedrock   │
                                            │ (Structure) │
                                            └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │    FHIR     │
                                            │ Transformer │
                                            └─────────────┘
```

## Supported Languages

VaidyaLink supports all 22 scheduled Indian languages:

| Language  | ISO Code | Script       | Example                |
| --------- | -------- | ------------ | ---------------------- |
| English   | en       | Latin        | "I have a headache"    |
| Hindi     | hi       | Devanagari   | "मुझे सिरदर्द है"      |
| Bengali   | bn       | Bengali      | "আমার মাথাব্যথা আছে"   |
| Telugu    | te       | Telugu       | "నాకు తలనొప్పి ఉంది"   |
| Marathi   | mr       | Devanagari   | "मला डोकेदुखी आहे"     |
| Tamil     | ta       | Tamil        | "எனக்கு தலைவலி உள்ளது" |
| Gujarati  | gu       | Gujarati     | "મને માથાનો દુખાવો છે" |
| Kannada   | kn       | Kannada      | "ನನಗೆ ತಲೆನೋವು ಇದೆ"     |
| Malayalam | ml       | Malayalam    | "എനിക്ക് തലവേദനയുണ്ട്" |
| Punjabi   | pa       | Gurmukhi     | "ਮੈਨੂੰ ਸਿਰ ਦਰਦ ਹੈ"     |
| Odia      | or       | Odia         | "ମୋର ମୁଣ୍ଡବିନ୍ଧା ଅଛି"  |
| Assamese  | as       | Bengali      | "মোৰ মূৰৰ বিষ আছে"     |
| Urdu      | ur       | Perso-Arabic | "مجھے سر درد ہے"       |
| Sanskrit  | sa       | Devanagari   | "मम शिरोवेदना अस्ति"   |
| Kashmiri  | ks       | Perso-Arabic | "مےٚ سَر دَرد چھُ"     |
| Sindhi    | sd       | Perso-Arabic | "مون کي سر درد آهي"    |
| Nepali    | ne       | Devanagari   | "मलाई टाउको दुख्छ"     |
| Konkani   | kok      | Devanagari   | "म्हाका दुकी आसा"      |
| Maithili  | mai      | Devanagari   | "हमरा माथा दुखैत अछि"  |
| Bodo      | bodo     | Devanagari   | "आंनि खामानि नाथाय"    |
| Dogri     | doi      | Devanagari   | "मिगी सिर च दर्द ऐ"    |
| Manipuri  | mni      | Bengali      | "ঐগী মখোং নাবা"        |

## API Configuration

### Environment Variables

```bash
# Bhashini API endpoint
BHASHINI_API_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline

# Bhashini API credentials
BHASHINI_API_KEY=your-api-key-here
BHASHINI_USER_ID=your-user-id-here
BHASHINI_ASR_SERVICE_ID=your-service-id-here

# Request configuration
BHASHINI_TIMEOUT=30
BHASHINI_MAX_RETRIES=3

# Transcription settings
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
ENABLE_PLAYBACK_CONFIRMATION=true
```

### Obtaining Bhashini Credentials

1. Visit [Bhashini Portal](https://bhashini.gov.in/)
2. Register for API access
3. Create an application
4. Obtain:
   - API Key
   - User ID
   - ASR Service ID

## API Request Format

### Request Structure

```javascript
{
  "pipelineTasks": [
    {
      "taskType": "asr",
      "config": {
        "language": {
          "sourceLanguage": "hi"  // ISO 639-1 code
        },
        "serviceId": "your-service-id",
        "audioFormat": "wav",
        "samplingRate": 16000
      }
    }
  ],
  "inputData": {
    "audio": [
      {
        "audioContent": "base64-encoded-audio-data"
      }
    ]
  }
}
```

### Request Headers

```javascript
{
  "Content-Type": "application/json",
  "Authorization": "your-api-key",
  "userID": "your-user-id"
}
```

## API Response Format

### Successful Response

```javascript
{
  "pipelineResponse": [
    {
      "taskType": "asr",
      "config": {
        "confidence": 0.92,
        "language": {
          "sourceLanguage": "hi"
        }
      },
      "output": [
        {
          "source": "मुझे सिरदर्द है और बुखार है"
        }
      ]
    }
  ]
}
```

### Response Fields

- `pipelineResponse`: Array of task results
- `taskType`: Type of task performed ("asr")
- `config.confidence`: Transcription confidence score (0.0 - 1.0)
- `config.language.sourceLanguage`: Detected language
- `output[0].source`: Transcribed text

## Implementation

### Core Transcription Function

```javascript
async function transcribeAudio(audioData, language) {
  try {
    // Convert audio buffer to base64
    const audioBase64 = audioData.toString('base64');

    // Prepare Bhashini API request
    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'asr',
          config: {
            language: {
              sourceLanguage: language,
            },
            serviceId: BHASHINI_ASR_SERVICE_ID,
            audioFormat: 'wav',
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    // Call Bhashini API
    const response = await axios.post(BHASHINI_API_URL, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: BHASHINI_API_KEY,
        userID: BHASHINI_USER_ID,
      },
      timeout: 30000,
    });

    // Extract transcription from response
    const pipelineResponse = response.data.pipelineResponse;
    const asrResult = pipelineResponse[0];
    const transcription = asrResult.output?.[0]?.source || '';
    const confidence = asrResult.config?.confidence || 0.0;
    const detectedLanguage = asrResult.config?.language?.sourceLanguage || language;

    return {
      transcription,
      confidence,
      detectedLanguage,
    };
  } catch (error) {
    console.error('Error transcribing audio with Bhashini:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}
```

## Audio Requirements

### Supported Formats

- **Format**: WAV (recommended)
- **Sampling Rate**: 16 kHz
- **Channels**: Mono (single channel)
- **Bit Depth**: 16-bit
- **Encoding**: PCM

### Audio Quality Guidelines

1. **Noise Level**: Keep ambient noise below 60 dB
2. **Duration**: 5 seconds to 2 minutes per recording
3. **File Size**: Maximum 10 MB
4. **Clarity**: Clear speech without background music

### Audio Preprocessing

```javascript
// Example: Convert audio to required format using ffmpeg
const ffmpeg = require('fluent-ffmpeg');

function preprocessAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate('256k')
      .format('wav')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}
```

## Confidence Scoring

### Confidence Threshold

- **High Confidence**: ≥ 0.75 → Auto-accept transcription
- **Low Confidence**: < 0.75 → Require user confirmation

### Handling Low Confidence

```javascript
const needsConfirmation =
  ENABLE_PLAYBACK_CONFIRMATION && confidence < TRANSCRIPTION_CONFIDENCE_THRESHOLD;

if (needsConfirmation) {
  // Update status to awaiting confirmation
  await updateJobStatus(jobId, 'confirming', {
    transcription,
    transcriptionConfidence: confidence,
    needsConfirmation: true,
  });

  // Notify user to confirm transcription
  await sendConfirmationRequest(jobId, transcription);
}
```

## Error Handling

### Common Errors

| Error Code   | Description           | Solution                        |
| ------------ | --------------------- | ------------------------------- |
| 400          | Invalid audio format  | Check audio format and encoding |
| 401          | Invalid API key       | Verify BHASHINI_API_KEY         |
| 429          | Rate limit exceeded   | Implement exponential backoff   |
| 500          | Internal server error | Retry with exponential backoff  |
| ECONNABORTED | Request timeout       | Increase timeout or retry       |

### Error Handling Implementation

```javascript
async function transcribeWithRetry(audioData, language, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioData, language);
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retry attempt ${attempt} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

## Performance Optimization

### Caching Strategy

```javascript
// Cache transcriptions to avoid redundant API calls
const transcriptionCache = new Map();

async function getCachedTranscription(audioHash, language) {
  const cacheKey = `${audioHash}-${language}`;

  if (transcriptionCache.has(cacheKey)) {
    console.log('Using cached transcription');
    return transcriptionCache.get(cacheKey);
  }

  const result = await transcribeAudio(audioData, language);
  transcriptionCache.set(cacheKey, result);

  return result;
}
```

### Batch Processing

For multiple audio files, process in parallel with concurrency control:

```javascript
const pLimit = require('p-limit');
const limit = pLimit(5); // Max 5 concurrent requests

async function transcribeBatch(audioFiles) {
  const promises = audioFiles.map((file) => limit(() => transcribeAudio(file.data, file.language)));

  return Promise.all(promises);
}
```

## Testing

### Unit Tests

```bash
# Run Bhashini integration tests
npm test -- bhashini-integration.test.js
```

### Manual Testing

```bash
# Test with sample audio file
curl -X POST https://api.vaidyalink.com/api/v1/voice/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@sample-hindi.wav" \
  -F "language=hi"
```

## Monitoring

### CloudWatch Metrics

- `BhashiniAPILatency`: API response time
- `BhashiniAPIErrors`: Error count
- `TranscriptionConfidence`: Average confidence score
- `LanguageDistribution`: Usage by language

### Logging

```javascript
console.log('Bhashini API Request:', {
  jobId,
  language,
  audioSize: audioData.length,
  timestamp: new Date().toISOString(),
});

console.log('Bhashini API Response:', {
  jobId,
  confidence,
  detectedLanguage,
  transcriptionLength: transcription.length,
  duration: Date.now() - startTime,
});
```

## Cost Optimization

### Pricing Model

Bhashini API pricing (as of 2024):

- **Free Tier**: 1,000 requests/month
- **Paid Tier**: ₹0.10 per request

### Cost Reduction Strategies

1. **Audio Compression**: Reduce file size before upload
2. **Caching**: Cache frequent transcriptions
3. **Batch Processing**: Group requests when possible
4. **Quality Filtering**: Reject poor quality audio early

## Security

### API Key Management

```javascript
// Store API keys in AWS Secrets Manager
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getBhashiniCredentials() {
  const client = new SecretsManagerClient();
  const command = new GetSecretValueCommand({
    SecretId: 'vaidyalink/bhashini-credentials',
  });

  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}
```

### Data Privacy

- Audio files encrypted at rest (S3 with KMS)
- Audio files encrypted in transit (TLS 1.3)
- Transcriptions stored with encryption
- Automatic deletion after 90 days (configurable)

## Troubleshooting

### Issue: Low Transcription Accuracy

**Symptoms**: Confidence scores consistently below 0.75

**Solutions**:

1. Check audio quality (noise, clarity)
2. Verify correct language selection
3. Ensure proper audio format (16kHz WAV)
4. Test with different microphones

### Issue: API Timeouts

**Symptoms**: Requests timing out after 30 seconds

**Solutions**:

1. Reduce audio file size
2. Check network connectivity
3. Increase timeout value
4. Implement retry logic

### Issue: Unsupported Language

**Symptoms**: Error "Unsupported language: XX"

**Solutions**:

1. Verify language code is in SUPPORTED_LANGUAGES
2. Check Bhashini service supports the language
3. Update SUPPORTED_LANGUAGES environment variable

## References

- [Bhashini Official Documentation](https://bhashini.gov.in/documentation)
- [Bhashini API Portal](https://bhashini.gov.in/api)
- [VaidyaLink Voice Processing Lambda](./src/index.js)
- [Voice Processing Tests](./src/__tests__/bhashini-integration.test.js)

## Support

For Bhashini API issues:

- Email: support@bhashini.gov.in
- Portal: https://bhashini.gov.in/support

For VaidyaLink integration issues:

- Create an issue in the repository
- Contact: dev@vaidyalink.com
