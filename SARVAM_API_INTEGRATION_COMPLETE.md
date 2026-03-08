# Sarvam API Integration Complete

Voice processing has been successfully migrated from Bhashini API to Sarvam API.

## Changes Made

### 1. Backend Lambda (`backend/voice-processing/src/index.js`)

**Environment Variables Updated**:

- Removed: `BHASHINI_API_URL`, `BHASHINI_API_KEY`, `BHASHINI_USER_ID`, `BHASHINI_ASR_SERVICE_ID`
- Added: `SARVAM_API_URL`, `SARVAM_API_KEY`

**transcribeAudio Function Rewritten**:

- Changed from Bhashini's JSON payload format to Sarvam's multipart/form-data format
- Updated request headers to use `api-subscription-key` instead of `Authorization`
- Updated response parsing to match Sarvam API response format:
  ```javascript
  {
    "transcript": "transcribed text",
    "language_code": "hi",
    "confidence": 0.95
  }
  ```

**Dependencies Added**:

- Added `form-data` package for multipart uploads

### 2. Package Configuration (`backend/voice-processing/package.json`)

- Updated description from "Bhashini API" to "Sarvam API"
- Added `form-data: ^4.0.0` dependency

### 3. Environment Configuration (`backend/voice-processing/.env.example`)

Replaced Bhashini configuration with Sarvam configuration:

```bash
# Sarvam API Configuration
SARVAM_API_URL=https://api.sarvam.ai/speech-to-text
SARVAM_API_KEY=
SARVAM_TIMEOUT=30
SARVAM_MAX_RETRIES=3
```

### 4. Frontend Component (`frontend/components/document-scan-demo/VoiceRecorder.tsx`)

**processWithSarvamAPI Function Implemented**:

- Uploads audio to S3 via presigned URL
- Polls for job status
- Handles completion, failure, and confirmation states
- Displays results when processing completes

**UI Updates**:

- Changed references from "Bhashini API" to "Sarvam API"
- Updated demo mode notice to mention Sarvam API key requirement

### 5. Documentation

**Created**:

- `backend/voice-processing/README.md` - Complete Lambda documentation
- `backend/voice-processing/deploy.ps1` - PowerShell deployment script

**Updated**:

- `infrastructure/docs/SARVAM_API_KEY_SETUP.md` - Updated secret names and instructions

## Sarvam API Details

### Endpoint

```
POST https://api.sarvam.ai/speech-to-text
```

### Request Format

```
Content-Type: multipart/form-data

Fields:
- file: audio file (WAV format)
- language_code: ISO 639-1 code (e.g., "hi", "en", "ta")
- model: "saaras:v1" (default)
```

### Response Format

```json
{
  "transcript": "transcribed text here",
  "language_code": "hi",
  "confidence": 0.95
}
```

### Authentication

```
Header: api-subscription-key: sk_sarvam_your_api_key_here
```

## Supported Languages

22 Indian languages supported:

- English (en)
- Hindi (hi)
- Bengali (bn)
- Telugu (te)
- Marathi (mr)
- Tamil (ta)
- Gujarati (gu)
- Kannada (kn)
- Malayalam (ml)
- Punjabi (pa)
- Odia (or)
- Assamese (as)
- Urdu (ur)

## Deployment Steps

### 1. Get Sarvam API Key

1. Visit [Sarvam AI](https://www.sarvam.ai/)
2. Sign up for an account
3. Generate an API key from the dashboard
4. Copy the key (format: `sk_sarvam_...`)

### 2. Install Dependencies

```bash
cd backend/voice-processing
npm install
```

### 3. Set API Key in AWS Secrets Manager

**Option A: Using PowerShell Script**

```powershell
cd infrastructure/scripts
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_your_key
```

**Option B: Using AWS CLI**

```bash
aws secretsmanager update-secret \
  --secret-id vaidyalink/voice-processing/sarvam-api-key-dev \
  --secret-string '{"apiKey":"sk_sarvam_your_key"}' \
  --region ap-south-1
```

**Option C: Set as Lambda Environment Variable**

```bash
aws lambda update-function-configuration \
  --function-name vaidyalink-voice-processing-dev \
  --environment Variables="{SARVAM_API_KEY=sk_sarvam_your_key}" \
  --region ap-south-1
```

### 4. Deploy Lambda Function

```powershell
cd backend/voice-processing
.\deploy.ps1
```

### 5. Test the Integration

**Test with Demo Mode**:

1. Set `NEXT_PUBLIC_DEMO_MODE=false` in `frontend/.env.local`
2. Start frontend: `npm run dev`
3. Navigate to voice recording page
4. Record audio and process

**Test with AWS CLI**:

```bash
# Create test job
aws lambda invoke \
  --function-name vaidyalink-voice-processing-dev \
  --payload '{"jobId":"test-job-123"}' \
  --region ap-south-1 \
  response.json

# Check response
cat response.json
```

## Testing Checklist

- [ ] Sarvam API key obtained
- [ ] API key stored in Secrets Manager or Lambda environment
- [ ] Dependencies installed (`npm install`)
- [ ] Lambda function deployed
- [ ] Test recording in demo mode works
- [ ] Test recording with real API works
- [ ] Transcription appears correctly
- [ ] Medical entities extracted
- [ ] Job status updates in DynamoDB
- [ ] CloudWatch logs show successful API calls

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/vaidyalink-voice-processing-dev --follow
```

### Check for Errors

Look for these log messages:

- ✅ "Sarvam API transcription: ..." - Success
- ❌ "Sarvam API error: 401" - Invalid API key
- ❌ "Empty transcription from Sarvam API" - Audio quality issue
- ❌ "Failed to transcribe audio with Sarvam API" - Network or API issue

## Cost Considerations

### Sarvam API Pricing

- Check [Sarvam AI Pricing](https://www.sarvam.ai/pricing) for current rates
- Typically charged per minute of audio processed
- Free tier may be available for testing

### AWS Costs (per 1000 requests)

- Lambda: ~$0.20 (128MB, 5s average)
- S3: ~$0.005 (storage + requests)
- DynamoDB: ~$0.25 (on-demand)
- Secrets Manager: ~$0.40/month (one-time)

## Troubleshooting

### Error: "Sarvam API error: 401"

**Cause**: Invalid or missing API key

**Solution**:

1. Verify API key is correct
2. Check Lambda environment variables
3. Ensure Secrets Manager secret is set correctly
4. Verify Lambda has permission to read secret

### Error: "Empty transcription from Sarvam API"

**Cause**: Audio quality too low or unsupported format

**Solution**:

1. Check audio format (should be WAV)
2. Verify audio duration (minimum 1 second)
3. Check for excessive background noise
4. Try recording again with better audio quality

### Error: "Failed to get voice job"

**Cause**: Job not found in DynamoDB

**Solution**:

1. Verify job was created before processing
2. Check DynamoDB table name in Lambda environment
3. Ensure Lambda has DynamoDB read permissions

### Error: "Cannot find module 'form-data'"

**Cause**: Dependencies not installed

**Solution**:

```bash
cd backend/voice-processing
npm install
.\deploy.ps1
```

## Next Steps

1. **Test with Real Audio**: Record and process real medical history
2. **Monitor Performance**: Check CloudWatch metrics for latency and errors
3. **Optimize Costs**: Review Sarvam API usage and optimize audio quality
4. **Add Error Handling**: Implement retry logic for transient failures
5. **Enable Confirmation**: Test low-confidence transcription confirmation flow
6. **FHIR Integration**: Verify FHIR transformation works correctly

## API Comparison: Bhashini vs Sarvam

| Feature          | Bhashini API                  | Sarvam API                  |
| ---------------- | ----------------------------- | --------------------------- |
| Request Format   | JSON (base64 audio)           | Multipart form-data         |
| Authentication   | Authorization header + userID | api-subscription-key header |
| Response Format  | Nested pipeline response      | Flat JSON response          |
| Language Support | 22 Indian languages           | 22 Indian languages         |
| Confidence Score | Yes                           | Yes                         |
| Code Mixing      | Yes                           | Yes                         |
| Pricing          | Government-backed             | Commercial                  |
| Availability     | Limited access                | Public API                  |

## References

- [Sarvam AI Documentation](https://docs.sarvam.ai/)
- [Sarvam API Pricing](https://www.sarvam.ai/pricing)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Voice Processing README](backend/voice-processing/README.md)
- [Sarvam API Key Setup Guide](infrastructure/docs/SARVAM_API_KEY_SETUP.md)

## Status

✅ Backend Lambda updated to use Sarvam API
✅ Frontend component updated with real API integration
✅ Environment configuration updated
✅ Documentation created
✅ Deployment script created
⏳ Awaiting Sarvam API key for testing
⏳ Awaiting Lambda deployment
⏳ Awaiting end-to-end testing

## Summary

Voice processing has been successfully migrated from Bhashini API to Sarvam API. The Lambda function now uses Sarvam's multipart/form-data API format, and the frontend component implements real API integration with polling for results. Deploy the Lambda and set your Sarvam API key to start using real voice transcription.
