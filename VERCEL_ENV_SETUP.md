# Add Sarvam AI to Vercel - Quick Guide

## 🚀 Your Sarvam AI Key is Ready!

API Key: `sk_ld64ppk4_5n2aZnLmTWAbpZ40s0WY3OQf`

---

## Step 1: Open Vercel Settings

Visit: https://vercel.com/gusfing/vaidya-link/settings/environment-variables

Or:

1. Go to https://vercel.com/
2. Click on "vaidya-link" project
3. Click "Settings" tab
4. Click "Environment Variables" in sidebar

---

## Step 2: Add These 3 Variables

### Variable 1: NEXT_PUBLIC_SARVAM_API_KEY

```
Name: NEXT_PUBLIC_SARVAM_API_KEY
Value: sk_ld64ppk4_5n2aZnLmTWAbpZ40s0WY3OQf
Environment: Production, Preview, Development (select all)
```

Click "Save"

### Variable 2: NEXT_PUBLIC_USE_SARVAM_AI

```
Name: NEXT_PUBLIC_USE_SARVAM_AI
Value: true
Environment: Production, Preview, Development (select all)
```

Click "Save"

### Variable 3: NEXT_PUBLIC_SARVAM_API_URL

```
Name: NEXT_PUBLIC_SARVAM_API_URL
Value: https://api.sarvam.ai/speech-to-text
Environment: Production, Preview, Development (select all)
```

Click "Save"

---

## Step 3: Redeploy

After adding all 3 variables:

### Option A: Automatic (Recommended)

Vercel will automatically redeploy. Wait 2-3 minutes.

### Option B: Manual Trigger

1. Go to "Deployments" tab
2. Click "..." on latest deployment
3. Click "Redeploy"

---

## Step 4: Test Voice Feature

1. Visit: https://vaidya-link.vercel.app/vaidyalink/voice
2. Click microphone button
3. Select language (Hindi, Tamil, etc.)
4. Speak and see real transcription!

---

## Optional: Disable Demo Mode

If you want to use ONLY real API (no demo data):

Add one more variable:

```
Name: NEXT_PUBLIC_DEMO_MODE
Value: false
Environment: Production
```

**Note**: Keep demo mode enabled for now to test both modes!

---

## Verification

After deployment completes:

✅ Voice page loads: https://vaidya-link.vercel.app/vaidyalink/voice
✅ Microphone button works
✅ Language selector appears
✅ Recording starts/stops
✅ Real transcription from Sarvam AI

---

## What You Get

- ✅ Real voice-to-text transcription
- ✅ 10+ Indian languages supported
- ✅ 1,000 free minutes/month
- ✅ Structured medical data extraction
- ✅ Production-ready voice feature

---

## Need Help?

If you see any issues:

1. Check environment variables are saved
2. Wait for deployment to complete (2-3 min)
3. Clear browser cache
4. Try in incognito mode

---

**That's it! Your voice feature is now powered by Sarvam AI!** 🎉
