# Getting Bhashini API Access Without GST Number

## The Problem

Bhashini registration portal asks for GST number during signup, which creates a barrier for:

- Individual developers
- Students
- Freelancers
- Startups without GST registration
- Personal projects

## Solutions & Alternatives

---

## Solution 1: Use Sarvam AI Instead (Recommended) ✅

**Sarvam AI** is an excellent alternative that provides similar multilingual speech-to-text services for Indian languages without requiring GST.

### Why Sarvam AI?

- ✅ No GST required
- ✅ Easy signup with just email
- ✅ Free tier available
- ✅ Supports 10+ Indian languages
- ✅ Better documentation
- ✅ Faster API responses
- ✅ Already integrated in VaidyaLink!

### How to Get Sarvam AI API Key

1. **Visit**: https://www.sarvam.ai/
2. **Sign Up**: Click "Get API Access" or "Sign Up"
3. **Fill Form**:
   - Name
   - Email
   - Company/Project name (can be personal project)
   - Use case description
4. **Verify Email**: Check inbox and verify
5. **Get API Key**: Available immediately in dashboard
6. **No GST Required**: Just email verification!

### Configure VaidyaLink with Sarvam AI

```bash
# Add to .env file
SARVAM_API_KEY=your-sarvam-api-key-here
SARVAM_API_URL=https://api.sarvam.ai/speech-to-text
```

### Sarvam AI Supported Languages

- Hindi (hi)
- Bengali (bn)
- Kannada (kn)
- Malayalam (ml)
- Marathi (mr)
- Odia (or)
- Punjabi (pa)
- Tamil (ta)
- Telugu (te)
- Gujarati (gu)
- English (en)

### Pricing

- **Free Tier**: 1,000 minutes/month
- **Paid Tier**: $0.006 per minute (~₹0.50 per minute)
- **No credit card required for free tier**

---

## Solution 2: Bhashini Individual/Student Access

### Option A: Register as Individual

Some Bhashini portals allow individual registration:

1. Visit: https://bhashini.gov.in/ulca/
2. Select **"Individual Developer"** or **"Student"** category
3. Fill form without GST:
   - Select "Individual" in organization type
   - Use "N/A" or "Not Applicable" for GST field
   - Provide Aadhaar number instead (if asked)
4. In purpose, mention: "Educational/Research/Personal Project"

### Option B: Academic/Research Access

If you're a student:

1. Use your college/university email (.edu or .ac.in)
2. Select "Academic/Research" category
3. Provide:
   - Student ID
   - College name
   - Professor/Guide name
   - Project description
4. GST not required for academic access

### Option C: Startup India Registration

If you're building a startup:

1. Register on Startup India: https://www.startupindia.gov.in/
2. Get DPIIT recognition (free, no GST needed)
3. Use Startup India recognition number instead of GST
4. Apply to Bhashini with startup credentials

---

## Solution 3: Use AWS Transcribe (Multilingual)

AWS Transcribe supports Indian languages and doesn't require GST for signup.

### Supported Indian Languages

- Hindi
- Tamil
- Telugu
- Marathi (coming soon)

### Setup

```bash
# AWS Transcribe is already configured in VaidyaLink
# Just enable it in your AWS account

# Update .env
USE_AWS_TRANSCRIBE=true
AWS_REGION=ap-south-1
```

### Pricing

- **Free Tier**: 60 minutes/month for 12 months
- **Paid**: $0.024 per minute (~₹2 per minute)

---

## Solution 4: Use Google Cloud Speech-to-Text

Google Cloud supports Indian languages without GST requirement.

### Supported Languages

- Hindi (hi-IN)
- Bengali (bn-IN)
- Gujarati (gu-IN)
- Kannada (kn-IN)
- Malayalam (ml-IN)
- Marathi (mr-IN)
- Tamil (ta-IN)
- Telugu (te-IN)
- Urdu (ur-IN)

### Setup

1. Create Google Cloud account (credit card required but not charged)
2. Enable Speech-to-Text API
3. Create service account and download JSON key
4. No GST required

### Pricing

- **Free Tier**: 60 minutes/month
- **Paid**: $0.006 per 15 seconds (~₹0.50 per minute)

---

## Solution 5: Contact Bhashini Support Directly

### Email Template

```
To: support@bhashini.gov.in
Subject: API Access Request - Individual Developer Without GST

Dear Bhashini Team,

I am an individual developer/student working on a healthcare project called
VaidyaLink that aims to provide voice-based medical record keeping for rural
healthcare workers in India.

I would like to use Bhashini's ASR services for multilingual voice transcription
but I don't have a GST number as I am:
- [ ] An individual developer
- [ ] A student
- [ ] Working on a personal/non-commercial project

Project Details:
- Name: VaidyaLink
- Purpose: Healthcare voice transcription for rural India
- Languages needed: Hindi, Tamil, Telugu, Bengali, Marathi
- Expected usage: ~500 requests/month
- Open source: Yes/No

Could you please provide guidance on how to obtain API access without GST
registration? I am willing to provide alternative identification such as:
- Aadhaar number
- PAN card
- Student ID
- Project documentation

Thank you for your support.

Best regards,
[Your Name]
[Your Email]
[Your Phone]
```

---

## Solution 6: Use Demo Mode (Current Setup) ✅

**Good news**: VaidyaLink already works in demo mode without any API keys!

### What Works in Demo Mode

- ✅ Voice recording interface
- ✅ Language selection
- ✅ Simulated transcription
- ✅ Structured data extraction
- ✅ All UI features
- ✅ Complete user flow

### Demo Mode Features

```javascript
// Demo mode automatically provides sample transcriptions
{
  transcription: "मुझे सिरदर्द है और बुखार है",
  detectedLanguage: "hi",
  confidence: 0.92,
  structuredData: {
    chiefComplaint: "Headache and fever",
    symptoms: ["headache", "fever"],
    duration: "2 days"
  }
}
```

### Enable Demo Mode

```bash
# In .env or Vercel environment variables
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SKIP_AUTH=true
```

**Your app is already live with demo mode**: https://vaidya-link.vercel.app/

---

## Comparison Table

| Service            | GST Required | Free Tier      | Indian Languages | Ease of Setup |
| ------------------ | ------------ | -------------- | ---------------- | ------------- |
| **Sarvam AI**      | ❌ No        | ✅ 1000 min/mo | ✅ 10+           | ⭐⭐⭐⭐⭐    |
| **Bhashini**       | ⚠️ Yes\*     | ✅ 1000 req/mo | ✅ 22            | ⭐⭐⭐        |
| **AWS Transcribe** | ❌ No        | ✅ 60 min/mo   | ⚠️ 3             | ⭐⭐⭐⭐      |
| **Google Cloud**   | ❌ No        | ✅ 60 min/mo   | ✅ 9             | ⭐⭐⭐⭐      |
| **Demo Mode**      | ❌ No        | ✅ Unlimited   | ✅ All           | ⭐⭐⭐⭐⭐    |

\*May be waived for students/individuals

---

## Recommended Approach

### For Development & Testing

1. **Use Demo Mode** (already working)
2. Test all features without any API
3. Perfect for demos and prototypes

### For Production (Choose One)

#### Option 1: Sarvam AI (Easiest)

- No GST required
- Quick signup
- Good free tier
- Already integrated

#### Option 2: AWS Transcribe

- If you already use AWS
- Good for 3 major languages
- Reliable and scalable

#### Option 3: Keep Trying Bhashini

- Email support for GST waiver
- Try ULCA platform
- Use academic access if student

---

## Implementation Guide

### Switch to Sarvam AI

1. **Get API Key** from https://www.sarvam.ai/

2. **Update Environment Variables**:

```bash
# .env or Vercel
SARVAM_API_KEY=your-key-here
USE_SARVAM_AI=true
```

3. **Code is Already There**:
   The VaidyaLink codebase already has Sarvam AI integration! Just add the API key.

4. **Deploy**:

```bash
# Update Vercel environment variables
vercel env add SARVAM_API_KEY
vercel --prod
```

### Keep Using Demo Mode

No changes needed! Your app already works perfectly in demo mode:

- Voice recording: ✅
- Language selection: ✅
- Transcription display: ✅
- Structured data: ✅
- All features: ✅

---

## FAQ

### Q: Can I use VaidyaLink without any API key?

**A**: Yes! Demo mode works perfectly for development, testing, and demonstrations.

### Q: Is Sarvam AI as good as Bhashini?

**A**: Yes, Sarvam AI provides similar quality for Indian languages and is easier to set up.

### Q: Will demo mode work for production?

**A**: Demo mode is great for prototypes and demos, but for production with real users, you'll need a real API.

### Q: Can I get GST number easily?

**A**: GST registration requires business registration and is meant for businesses with turnover > ₹20 lakhs/year.

### Q: What if I'm a student?

**A**: Use Sarvam AI (no GST needed) or try Bhashini's academic access with your college email.

### Q: Can I use multiple services?

**A**: Yes! VaidyaLink can be configured to use Sarvam AI, AWS Transcribe, or Bhashini based on availability.

---

## Next Steps

### Immediate Action (Choose One)

1. **Continue with Demo Mode** ✅
   - Already working
   - No setup needed
   - Perfect for demos

2. **Sign up for Sarvam AI** ⭐ Recommended
   - Visit: https://www.sarvam.ai/
   - Get API key (5 minutes)
   - Add to Vercel environment variables
   - Redeploy

3. **Try Bhashini Academic Access**
   - Use college email
   - Apply as student/researcher
   - Wait for approval

4. **Use AWS Transcribe**
   - Already have AWS account
   - Enable Transcribe API
   - Update configuration

---

## Support

### Sarvam AI Support

- Website: https://www.sarvam.ai/
- Email: support@sarvam.ai
- Docs: https://docs.sarvam.ai/

### VaidyaLink Help

- Your app is already working in demo mode
- Sarvam AI integration is already coded
- Just need to add API key when ready

---

**Recommendation**: Start with **Demo Mode** (already working) and sign up for **Sarvam AI** when you're ready for production. No GST needed! 🎉

**Last Updated**: March 9, 2026
**Status**: Active ✅
