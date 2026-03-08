# How to Get Bhashini API Key - Complete Guide

## What is Bhashini?

**Bhashini** (भाषिणी) is the Government of India's National Language Translation Mission platform that provides AI-powered language services including:

- **ASR (Automatic Speech Recognition)**: Speech-to-text for 22 Indian languages
- **NMT (Neural Machine Translation)**: Translation between Indian languages
- **TTS (Text-to-Speech)**: Voice synthesis in Indian languages

For VaidyaLink, we use Bhashini's ASR service to transcribe medical voice notes in regional languages.

---

## Step-by-Step Guide to Get API Key

### Step 1: Visit Bhashini Portal

1. Open your browser and go to: **https://bhashini.gov.in/**
2. Click on **"Get Started"** or **"API Access"** button

### Step 2: Register/Sign Up

1. Click on **"Sign Up"** or **"Register"**
2. Fill in the registration form:
   - **Full Name**: Your name or organization name
   - **Email Address**: Valid email (you'll receive verification link)
   - **Mobile Number**: Indian mobile number (+91)
   - **Organization**: Your company/institution name
   - **Purpose**: Select "Healthcare" or "Application Development"
   - **Use Case**: Describe your project (e.g., "Medical voice transcription for rural healthcare")

3. Accept Terms & Conditions
4. Click **"Submit"**

### Step 3: Email Verification

1. Check your email inbox for verification email from Bhashini
2. Click the verification link in the email
3. Your account will be activated

### Step 4: Login to Bhashini Portal

1. Go to: **https://bhashini.gov.in/login**
2. Enter your registered email and password
3. Click **"Login"**

### Step 5: Create an Application

1. After login, go to **"Dashboard"** or **"My Applications"**
2. Click **"Create New Application"** button
3. Fill in application details:
   - **Application Name**: "VaidyaLink Voice Processing"
   - **Description**: "Medical voice transcription for healthcare workers"
   - **Category**: Healthcare
   - **Services Required**: Select "ASR (Speech Recognition)"
   - **Languages**: Select all languages you need (Hindi, Tamil, Telugu, etc.)
   - **Expected Usage**: Estimate monthly requests (e.g., 10,000 requests/month)

4. Click **"Submit Application"**

### Step 6: Wait for Approval

1. Your application will be reviewed by Bhashini team
2. **Approval Time**: Usually 1-3 business days
3. You'll receive an email notification once approved

### Step 7: Get Your API Credentials

Once approved, you'll receive:

1. **API Key** (Authorization token)
2. **User ID** (Your unique identifier)
3. **Service ID** (ASR service identifier)
4. **API Endpoint URL**

These will be available in your dashboard under **"API Credentials"** section.

---

## Alternative Method: Bhashini ULCA Platform

If the main portal doesn't work, try the ULCA (Universal Language Contribution API) platform:

### Step 1: Visit ULCA Portal

Go to: **https://bhashini.gov.in/ulca/**

### Step 2: Register on ULCA

1. Click **"Sign Up"**
2. Fill registration form
3. Verify email
4. Login to ULCA dashboard

### Step 3: Generate API Key

1. Go to **"API Keys"** section
2. Click **"Generate New Key"**
3. Select services: **ASR**
4. Select languages needed
5. Click **"Generate"**

### Step 4: Copy Credentials

Copy and save:

- API Key
- User ID
- Service ID

---

## What You'll Receive

After approval, you'll get credentials in this format:

```json
{
  "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_12345abcde",
  "serviceId": "ai4bharat/conformer-hi-gpu--t4",
  "endpoint": "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
}
```

---

## Configure VaidyaLink with Bhashini Credentials

### Option 1: Using AWS Secrets Manager (Recommended for Production)

```bash
# Store credentials in AWS Secrets Manager
aws secretsmanager create-secret \
  --name vaidyalink/bhashini-credentials \
  --description "Bhashini API credentials for voice processing" \
  --secret-string '{
    "apiKey": "your-api-key-here",
    "userId": "your-user-id-here",
    "serviceId": "your-service-id-here"
  }'
```

### Option 2: Using Environment Variables (Development)

Add to your `.env` file:

```bash
# Bhashini API Configuration
BHASHINI_API_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline
BHASHINI_API_KEY=your-api-key-here
BHASHINI_USER_ID=your-user-id-here
BHASHINI_ASR_SERVICE_ID=your-service-id-here
```

### Option 3: Using Lambda Environment Variables

```bash
# Update Lambda function environment variables
aws lambda update-function-configuration \
  --function-name vaidyalink-voice-processing \
  --environment Variables="{
    BHASHINI_API_KEY=your-api-key-here,
    BHASHINI_USER_ID=your-user-id-here,
    BHASHINI_ASR_SERVICE_ID=your-service-id-here
  }"
```

---

## Test Your API Key

### Using cURL

```bash
# Test Bhashini API with sample request
curl -X POST https://dhruva-api.bhashini.gov.in/services/inference/pipeline \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_API_KEY" \
  -H "userID: YOUR_USER_ID" \
  -d '{
    "pipelineTasks": [{
      "taskType": "asr",
      "config": {
        "language": {
          "sourceLanguage": "hi"
        },
        "serviceId": "YOUR_SERVICE_ID",
        "audioFormat": "wav",
        "samplingRate": 16000
      }
    }],
    "inputData": {
      "audio": [{
        "audioContent": "BASE64_ENCODED_AUDIO"
      }]
    }
  }'
```

### Using VaidyaLink Test Script

```bash
# Navigate to voice processing directory
cd backend/voice-processing

# Run test script
npm test -- bhashini-integration.test.js
```

---

## Pricing & Limits

### Free Tier

- **Requests**: 1,000 requests/month
- **Rate Limit**: 10 requests/minute
- **Audio Duration**: Up to 2 minutes per file
- **File Size**: Maximum 10 MB

### Paid Tier

- **Cost**: ₹0.10 per request (approximately $0.0012 USD)
- **Rate Limit**: 100 requests/minute
- **Audio Duration**: Up to 5 minutes per file
- **File Size**: Maximum 25 MB

### Enterprise Tier

- **Custom Pricing**: Contact Bhashini team
- **Dedicated Support**: Priority support
- **Higher Limits**: Custom rate limits
- **SLA**: 99.9% uptime guarantee

---

## Supported Languages

Bhashini supports all 22 scheduled Indian languages:

| Language  | Code | Script       |
| --------- | ---- | ------------ |
| English   | en   | Latin        |
| Hindi     | hi   | Devanagari   |
| Bengali   | bn   | Bengali      |
| Telugu    | te   | Telugu       |
| Marathi   | mr   | Devanagari   |
| Tamil     | ta   | Tamil        |
| Gujarati  | gu   | Gujarati     |
| Kannada   | kn   | Kannada      |
| Malayalam | ml   | Malayalam    |
| Punjabi   | pa   | Gurmukhi     |
| Odia      | or   | Odia         |
| Assamese  | as   | Bengali      |
| Urdu      | ur   | Perso-Arabic |
| Sanskrit  | sa   | Devanagari   |
| Kashmiri  | ks   | Perso-Arabic |
| Sindhi    | sd   | Perso-Arabic |
| Nepali    | ne   | Devanagari   |
| Konkani   | kok  | Devanagari   |
| Maithili  | mai  | Devanagari   |
| Bodo      | bodo | Devanagari   |
| Dogri     | doi  | Devanagari   |
| Manipuri  | mni  | Bengali      |

---

## Troubleshooting

### Issue: Registration Email Not Received

**Solution**:

1. Check spam/junk folder
2. Wait 10-15 minutes (emails can be delayed)
3. Try resending verification email
4. Contact support: support@bhashini.gov.in

### Issue: Application Not Approved

**Solution**:

1. Check application status in dashboard
2. Ensure all required fields were filled correctly
3. Provide detailed use case description
4. Contact Bhashini support for status update

### Issue: API Key Not Working

**Solution**:

1. Verify API key is copied correctly (no extra spaces)
2. Check if API key has expired
3. Ensure User ID and Service ID are correct
4. Test with sample request using cURL
5. Check API usage limits haven't been exceeded

### Issue: "Invalid Service ID" Error

**Solution**:

1. Verify Service ID matches your approved services
2. Check if service is available for selected language
3. Request access to additional services if needed

---

## Security Best Practices

### 1. Never Commit API Keys to Git

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "*.key" >> .gitignore
```

### 2. Use Environment Variables

```javascript
// Good ✅
const apiKey = process.env.BHASHINI_API_KEY;

// Bad ❌
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. Rotate Keys Regularly

- Rotate API keys every 90 days
- Generate new keys before old ones expire
- Update all services with new keys

### 4. Use AWS Secrets Manager

```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getBhashiniCredentials() {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: 'vaidyalink/bhashini-credentials',
    })
  );
  return JSON.parse(response.SecretString);
}
```

### 5. Implement Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const bhashiniLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to Bhashini API',
});

app.use('/api/voice/transcribe', bhashiniLimiter);
```

---

## Support & Resources

### Official Bhashini Resources

- **Website**: https://bhashini.gov.in/
- **Documentation**: https://bhashini.gov.in/documentation
- **API Portal**: https://bhashini.gov.in/api
- **ULCA Platform**: https://bhashini.gov.in/ulca/

### Contact Bhashini Support

- **Email**: support@bhashini.gov.in
- **Phone**: +91-11-XXXX-XXXX (Check website for current number)
- **Support Portal**: https://bhashini.gov.in/support
- **Response Time**: 1-2 business days

### VaidyaLink Resources

- **Integration Guide**: `backend/voice-processing/BHASHINI_INTEGRATION.md`
- **Quick Start**: `backend/voice-processing/BHASHINI_QUICK_START.md`
- **Test Scripts**: `backend/voice-processing/src/__tests__/`
- **Example Code**: `backend/voice-processing/src/utils/`

---

## Next Steps

After getting your Bhashini API key:

1. ✅ Configure credentials in AWS Secrets Manager or environment variables
2. ✅ Test API connection with sample audio
3. ✅ Deploy voice processing Lambda function
4. ✅ Update frontend to enable voice recording
5. ✅ Test end-to-end voice transcription flow
6. ✅ Monitor API usage and costs
7. ✅ Set up CloudWatch alarms for errors

---

## FAQ

### Q: Is Bhashini free to use?

**A**: Yes, Bhashini offers a free tier with 1,000 requests/month. Paid tiers are available for higher usage.

### Q: How long does API approval take?

**A**: Usually 1-3 business days. Enterprise applications may take longer.

### Q: Can I use Bhashini for commercial projects?

**A**: Yes, Bhashini can be used for commercial projects. Check terms of service for details.

### Q: What audio formats are supported?

**A**: WAV format with 16kHz sampling rate is recommended. Other formats may work but require conversion.

### Q: How accurate is the transcription?

**A**: Accuracy varies by language and audio quality. Typically 85-95% for clear audio in major languages.

### Q: Can I use Bhashini outside India?

**A**: Yes, the API can be accessed globally, but it's optimized for Indian languages.

### Q: What if my language is not supported?

**A**: Contact Bhashini team to request support for additional languages or dialects.

### Q: How do I increase my rate limits?

**A**: Upgrade to paid tier or contact Bhashini for enterprise plans with custom limits.

---

**Last Updated**: March 9, 2026
**Version**: 1.0
**Status**: Active ✅
