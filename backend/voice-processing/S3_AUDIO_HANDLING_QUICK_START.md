# S3 Audio Handling Quick Start

Get started with S3 audio file handling in the Voice Processing Lambda in 5 minutes.

## Prerequisites

- AWS Account with S3 and Lambda access
- Node.js 18+
- AWS CLI configured

## Step 1: Configure S3 Bucket

Create S3 bucket for audio storage:

```bash
aws s3api create-bucket \
  --bucket vaidyalink-audio-dev \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket vaidyalink-audio-dev \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket vaidyalink-audio-dev \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms"
      }
    }]
  }'
```

## Step 2: Configure S3 Event Notification

Set up S3 to trigger Lambda on audio upload:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket vaidyalink-audio-dev \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "Id": "VoiceProcessingTrigger",
      "LambdaFunctionArn": "arn:aws:lambda:ap-south-1:ACCOUNT_ID:function:vaidyalink-voice-processing-dev",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [{
            "Name": "prefix",
            "Value": "audio/"
          }, {
            "Name": "suffix",
            "Value": ".wav"
          }]
        }
      }
    }]
  }'
```

## Step 3: Grant Lambda Permissions

Add S3 permissions to Lambda execution role:

```bash
aws iam put-role-policy \
  --role-name vaidyalink-voice-processing-role \
  --policy-name S3AudioAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::vaidyalink-audio-dev/*"
    }]
  }'
```

## Step 4: Configure Environment Variables

Update Lambda environment variables:

```bash
aws lambda update-function-configuration \
  --function-name vaidyalink-voice-processing-dev \
  --environment Variables="{
    S3_AUDIO_BUCKET=vaidyalink-audio-dev,
    VOICEJOBS_TABLE=vaidyalink-voice-jobs-dev,
    BHASHINI_API_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline,
    BHASHINI_API_KEY=your-api-key,
    TRANSCRIPTION_CONFIDENCE_THRESHOLD=0.75
  }"
```

## Step 5: Test Audio Upload

Upload a test audio file:

```bash
# Create test audio file (requires ffmpeg)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" \
  -ar 16000 -ac 1 -sample_fmt s16 test-audio.wav

# Upload to S3
aws s3 cp test-audio.wav \
  s3://vaidyalink-audio-dev/audio/patient-test/job-test-123/recording.wav
```

## Step 6: Verify Processing

Check Lambda logs:

```bash
aws logs tail /aws/lambda/vaidyalink-voice-processing-dev --follow
```

Expected output:

```
Processing S3 audio file: s3://vaidyalink-audio-dev/audio/patient-test/job-test-123/recording.wav
Downloading audio from s3://vaidyalink-audio-dev/audio/patient-test/job-test-123/recording.wav
Transcribing audio with Bhashini (language: en)
Transcription completed - Confidence: 0.92
Voice processing completed for job job-test-123 in 3245ms
```

## Common Use Cases

### Use Case 1: Upload Audio via Pre-signed URL

```javascript
// Frontend code
const response = await fetch('/api/v1/voice/upload-url', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    patientId: 'patient-123',
    language: 'hi',
    fileName: 'recording.wav',
  }),
});

const { uploadUrl, jobId } = await response.json();

// Upload audio file
await fetch(uploadUrl, {
  method: 'PUT',
  body: audioBlob,
  headers: {
    'Content-Type': 'audio/wav',
  },
});

console.log(`Audio uploaded, job ID: ${jobId}`);
```

### Use Case 2: Direct Lambda Invocation

```bash
aws lambda invoke \
  --function-name vaidyalink-voice-processing-dev \
  --payload '{"jobId": "voice-job-123"}' \
  response.json

cat response.json
```

### Use Case 3: Batch Processing

```bash
# Upload multiple audio files
for i in {1..10}; do
  aws s3 cp audio-$i.wav \
    s3://vaidyalink-audio-dev/audio/patient-batch/job-$i/recording.wav
done

# Lambda will process all files automatically
```

## Monitoring

### View CloudWatch Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=vaidyalink-voice-processing-dev \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Average
```

### Check S3 Event Notifications

```bash
aws s3api get-bucket-notification-configuration \
  --bucket vaidyalink-audio-dev
```

## Troubleshooting

### Issue: Lambda not triggered

**Check S3 event configuration:**

```bash
aws s3api get-bucket-notification-configuration \
  --bucket vaidyalink-audio-dev
```

**Verify Lambda permissions:**

```bash
aws lambda get-policy \
  --function-name vaidyalink-voice-processing-dev
```

### Issue: Access Denied errors

**Grant S3 invoke permission to Lambda:**

```bash
aws lambda add-permission \
  --function-name vaidyalink-voice-processing-dev \
  --statement-id S3InvokeFunction \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::vaidyalink-audio-dev
```

### Issue: Audio file not found

**List S3 objects:**

```bash
aws s3 ls s3://vaidyalink-audio-dev/audio/ --recursive
```

**Check DynamoDB record:**

```bash
aws dynamodb get-item \
  --table-name vaidyalink-voice-jobs-dev \
  --key '{"PK": {"S": "VOICE#job-123"}, "SK": {"S": "METADATA"}}'
```

## Testing

Run S3 audio handling tests:

```bash
cd backend/voice-processing
npm test -- s3-audio-handling.test.js
```

## Performance Tips

1. **Use same region**: Keep S3 bucket and Lambda in same region
2. **Optimize file size**: Compress audio to reduce download time
3. **Enable S3 Transfer Acceleration**: For cross-region uploads
4. **Increase Lambda memory**: More memory = faster processing
5. **Use streaming**: Already implemented for large files

## Security Checklist

- ✅ S3 bucket encryption enabled
- ✅ Bucket versioning enabled
- ✅ IAM permissions follow least privilege
- ✅ S3 bucket policy denies unencrypted uploads
- ✅ CloudTrail logging enabled
- ✅ Audio files auto-delete after 90 days

## Next Steps

- [Full S3 Audio Handling Guide](./S3_AUDIO_HANDLING.md)
- [Voice Processing README](./README.md)
- [Bhashini Integration](./BHASHINI_INTEGRATION.md)

## Support

For issues:

- Check logs: `aws logs tail /aws/lambda/vaidyalink-voice-processing-dev --follow`
- Review X-Ray traces in AWS Console
- Contact: dev@vaidyalink.com
