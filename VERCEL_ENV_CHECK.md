# Vercel Environment Variables Check

## Required Environment Variables

Make sure these are set in Vercel Dashboard (Settings → Environment Variables):

### Critical for Document Scanner:

```
NEXT_PUBLIC_DEMO_MODE=true
```

### Other Variables (already set):

```
NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_SKIP_AUTH=true
NEXT_PUBLIC_SARVAM_API_KEY=sk_ld64ppk4_5n2aZnLmTWAbpZ40s0WY3OQf
NEXT_PUBLIC_USE_SARVAM_AI=true
```

## How to Check/Set in Vercel:

1. Go to https://vercel.com/gusfing/vaidya-link
2. Click "Settings"
3. Click "Environment Variables"
4. Verify `NEXT_PUBLIC_DEMO_MODE` is set to `true`
5. If not, add it:
   - Name: `NEXT_PUBLIC_DEMO_MODE`
   - Value: `true`
   - Environment: Production, Preview, Development (all)
6. Click "Save"
7. Redeploy: Go to "Deployments" → Click "..." on latest → "Redeploy"

## Why This Matters:

The document scanner checks `process.env.NEXT_PUBLIC_DEMO_MODE` to decide whether to:

- Use demo data (when `true`) ✅
- Call AWS API (when `false` or undefined) ❌ causes 405 error

## Current Issue:

Getting "Request failed with status code 405" means the app is trying to call the AWS API endpoint `/document/process` which doesn't exist or isn't configured properly.

## Solution:

Ensure `NEXT_PUBLIC_DEMO_MODE=true` is set in Vercel, then redeploy.
