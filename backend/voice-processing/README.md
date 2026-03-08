# Voice Processing Lambda - Sarvam API Integration

This Lambda function handles multilingual voice-to-text transcription using Sarvam API and structures the transcribed medical history using Amazon Bedrock.

## Features

- **22 Indian Languages**: Supports Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, and more
- **Sarvam API Integration**: Uses Sarvam AI's speech-to-text API for accurate transcription
- **Clinical Entity Extraction**: Extracts medical entities (symptoms, medications, allergies) using Bedrock
- **FHIR Transformation**: Automatically converts structured data to FHIR Observation resources
- **Confidence Scoring**: Provides confidence scores for transcription and entity extraction
- **Playback Confirmation**: Optional user confirmation for low-confidence transcriptions

## Architecture

```
Audio Upload → S3 → Lambda Trigger → Sarvam API → Bedrock → FHIR Transformer
                                         ↓
                                    DynamoDB (Job Status)
```

## Prerequisites

1. **Sarvam API Key**: Get from [Sarvam AI](https://www.sarvam.ai/)
2. **AWS Account**: With Lambda, S3, DynamoDB, and Bedrock access
3. **Node.js 18**: Lambda runtime
4. **AWS CLI**: For deployment

## Environment Variables

Required environment variables (set in Lambda configuration):

```bash
# AWS Resources
VOICEJOBS_TABLE=vaidyalink-voice-jobs-dev
S3_AUDIO_BUCKET=vaidyalink-audio-dev

# Sarvam API
SARVAM_API_URL=https://api.sarvam.ai/speech-to-text
SARVAM_API_KEY=sk_sarvam_your_api_key_here

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1

# Configuration
TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
ENABLE_PLAYBACK_CONFIRMATION=true
SUPPORTED_LANGUAGES=en,hi,bn,te,mr,ta,gu,kn,ml,pa,or,as,ur

# FHIR Integration
FHIR_TRANSFORMER_LAMBDA_ARN=arn:aws:lambda:ap-south-1:ACCOUNT_ID:function:vaidyalink-fhir-transformer-dev
```

## Installation

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint
```

## Deployment

### Using PowerShell Script (Recommended)

```powershell
# Deploy to AWS
.\deploy.ps1
```

### Manual Deployment

```bash
# Install dependencies
npm install

# Create deployment package
mkdir lambda-package
cp -r src/* lambda-package/
cp -r node_modules lambda-package/
cd lambda-package
zip -r ../voice-processing-lambda.zip .
cd ..

# Update Lambda function
aws lambda update-function-code \
  --function-name vaidyalink-voice-processing-dev \
  --zip-file fileb://voice-processing-lambda.zip \
  --region ap-south-1
```

## Sarvam API Setup

1. **Get API Key**:
   - Visit [Sarvam AI](https://www.sarvam.ai/)
   - Sign up and generate an API key
   - Copy the key (format: `sk_sarvam_...`)

2. **Store in Secrets Manager**:

   ```bash
   # Using helper script
   cd infrastructure/scripts
   ./set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_your_key
   ```

3. **Update Lambda Environment**:
   - The Lambda will automatically retrieve the key from Secrets Manager
   - Or set directly as environment variable (less secure)

See [SARVAM_API_KEY_SETUP.md](../../infrastructure/docs/SARVAM_API_KEY_SETUP.md) for detailed instructions.

## API Endpoints

### 1. Main Handler (S3 Event or Direct Invocation)

**S3 Event Trigger**:

```json
{
  "Records": [
    {
      "s3": {
        "bucket": { "name": "vaidyalink-audio-dev" },
        "object": { "key": "audio/user123/job456/recording.wav" }
      }
    }
  ]
}
```

**Direct Invocation**:

```json
{
  "jobId": "voice-job-123"
}
```

### 2. Get Job Status

```javascript
// Input
{
  "jobId": "voice-job-123"
}

// Output
{
  "jobId": "voice-job-123",
  "status": "completed",
  "transcription": "मुझे सिरदर्द है",
  "detectedLanguage": "hi",
  "transcriptionConfidence": 0.92,
  "structuredData": {
    "chiefComplaint": "Headache",
    "symptoms": ["headache"],
    "duration": "2 days"
  }
}
```

### 3. Process Confirmation

```javascript
// Input
{
  "jobId": "voice-job-123",
  "confirmed": true,
  "editedTranscription": "मुझे सिरदर्द और बुखार है" // optional
}

// Output
{
  "message": "Confirmation processed successfully",
  "jobId": "voice-job-123",
  "status": "completed",
  "entityCount": 5
}
```

## Supported Languages

| Code | Language  | Native Name |
| ---- | --------- | ----------- |
| en   | English   | English     |
| hi   | Hindi     | हिंदी       |
| bn   | Bengali   | বাংলা       |
| te   | Telugu    | తెలుగు      |
| mr   | Marathi   | मराठी       |
| ta   | Tamil     | தமிழ்       |
| gu   | Gujarati  | ગુજરાતી     |
| kn   | Kannada   | ಕನ್ನಡ       |
| ml   | Malayalam | മലയാളം      |
| pa   | Punjabi   | ਪੰਜਾਬੀ      |
| or   | Odia      | ଓଡ଼ିଆ       |
| as   | Assamese  | অসমীয়া     |
| ur   | Urdu      | اردو        |

## Processing Pipeline

1. **Audio Upload**: Client uploads audio to S3
2. **Language Detection**: Detect language from audio or use user-specified language
3. **Transcription**: Send audio to Sarvam API for speech-to-text
4. **Confidence Check**: If confidence < threshold, route to user confirmation
5. **Entity Extraction**: Use Bedrock to extract medical entities
6. **FHIR Mapping**: Convert entities to FHIR Observation resources
7. **Status Update**: Update job status in DynamoDB

## Error Handling

The Lambda handles various error scenarios:

- **Invalid Audio Format**: Returns 400 error
- **Unsupported Language**: Returns 400 error
- **Sarvam API Failure**: Retries up to 3 times, then fails job
- **Bedrock Failure**: Logs error but doesn't fail job
- **FHIR Transformation Failure**: Logs error but doesn't fail job (non-blocking)

## Monitoring

### CloudWatch Logs

```bash
# View logs
aws logs tail /aws/lambda/vaidyalink-voice-processing-dev --follow
```

### CloudWatch Metrics

- **Invocations**: Number of Lambda invocations
- **Duration**: Execution time
- **Errors**: Failed invocations
- **Throttles**: Rate-limited invocations

### Custom Metrics

- **TranscriptionConfidence**: Average confidence score
- **EntityExtractionSuccess**: Successful entity extractions
- **SarvamAPILatency**: Sarvam API response time

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Test with sample audio
aws lambda invoke \
  --function-name vaidyalink-voice-processing-dev \
  --payload '{"jobId":"test-job-123"}' \
  --region ap-south-1 \
  response.json

cat response.json
```

### Local Testing

```bash
# Set environment variables
export VOICEJOBS_TABLE=vaidyalink-voice-jobs-dev
export S3_AUDIO_BUCKET=vaidyalink-audio-dev
export SARVAM_API_KEY=sk_sarvam_your_key

# Run locally (requires SAM CLI)
sam local invoke VoiceProcessingFunction -e test-event.json
```

## Troubleshooting

### Error: "Sarvam API error: 401"

**Cause**: Invalid or missing API key

**Solution**:

1. Check API key in Secrets Manager
2. Verify Lambda has permission to read secret
3. Ensure API key is valid and not expired

### Error: "Empty transcription from Sarvam API"

**Cause**: Audio quality too low or unsupported format

**Solution**:

1. Check audio format (should be WAV, 16kHz)
2. Verify audio duration (minimum 1 second)
3. Check for background noise

### Error: "Failed to get voice job"

**Cause**: Job not found in DynamoDB

**Solution**:

1. Verify job was created before processing
2. Check DynamoDB table name in environment variables
3. Ensure Lambda has DynamoDB read permissions

## Performance Optimization

- **Cold Start**: ~2-3 seconds (includes dependency loading)
- **Warm Start**: ~500ms
- **Sarvam API Latency**: ~1-2 seconds per audio file
- **Bedrock Latency**: ~1-2 seconds per extraction

### Optimization Tips

1. **Increase Memory**: Higher memory = faster CPU
2. **Enable Provisioned Concurrency**: Eliminate cold starts
3. **Cache API Keys**: Store in global variable
4. **Batch Processing**: Process multiple jobs in parallel

## Cost Estimation

### Per 1000 Requests

- **Lambda**: $0.20 (128MB, 5s average)
- **Sarvam API**: Variable (check Sarvam pricing)
- **Bedrock**: $0.015 (Claude Sonnet)
- **S3**: $0.005 (storage + requests)
- **DynamoDB**: $0.25 (on-demand)

**Total**: ~$0.47 + Sarvam API costs

## Security

- **API Key Storage**: Stored in AWS Secrets Manager
- **Encryption**: Audio files encrypted at rest (S3 KMS)
- **IAM Permissions**: Least privilege access
- **VPC**: Optional VPC deployment for enhanced security

## References

- [Sarvam AI Documentation](https://docs.sarvam.ai/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [FHIR Observation Resource](https://www.hl7.org/fhir/observation.html)

## Support

For issues or questions:

1. Check CloudWatch logs
2. Review [SARVAM_API_KEY_SETUP.md](../../infrastructure/docs/SARVAM_API_KEY_SETUP.md)
3. Contact Sarvam AI support for API issues
4. Open an issue in the repository
