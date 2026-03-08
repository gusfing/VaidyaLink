# Bedrock Payment Issue Troubleshooting (UPI Active)

## Your Situation

- ✅ UPI payment method is already active
- ❌ Still getting: `INVALID_PAYMENT_INSTRUMENT` error
- ❌ Also getting: `Too many tokens per day` error

## Possible Issues & Solutions

### Issue 1: UPI Payment Not Set as Default

Even if UPI is active, it might not be set as the **default** payment method.

**Solution:**

1. Go to AWS Console → Billing → Payment methods
2. Find your UPI payment method
3. Click **"Set as default"** or **"Make default"**
4. Wait 2-5 minutes for AWS to process

### Issue 2: UPI Payment Verification Pending

UPI payments sometimes need additional verification.

**Solution:**

1. Check your UPI app for any pending verification requests
2. Look for small test charges from AWS (₹1-2)
3. Approve any pending transactions
4. Wait 5-10 minutes after approval

### Issue 3: AWS Marketplace Subscription Required

Some Bedrock models (especially Anthropic Claude) require an AWS Marketplace subscription, even with valid payment.

**Solution:**

1. Go to AWS Console → Amazon Bedrock
2. Click **"Model access"** in left sidebar
3. Click **"Manage model access"**
4. Find **Anthropic Claude 3 Haiku**
5. Check if it says "Subscription required"
6. If yes, click **"Subscribe"** or **"Request access"**
7. Fill out the use case form if prompted
8. Wait for approval (usually instant, sometimes 2-24 hours)

### Issue 4: Region-Specific Payment Issues

Your infrastructure is in `ap-south-1` (Mumbai), but payment methods sometimes have region-specific issues.

**Solution:**

1. Verify your payment method works in `ap-south-1` region
2. Try adding a credit/debit card as backup payment method
3. Set the card as default temporarily to test

### Issue 5: Daily Token Limit (Separate Issue)

The "Too many tokens per day" error is a **separate issue** from payment. This is a free tier limit.

**Current Status:**

- You've hit the daily free tier limit for Bedrock
- This limit resets at **midnight UTC** (5:30 AM IST)

**Solutions:**

1. **Wait until tomorrow** (after 5:30 AM IST) for limit to reset
2. **Use Demo Mode** for now (already working perfectly)
3. **Upgrade to paid tier** (after payment issue is resolved)

## Recommended Action Plan

### Step 1: Verify Payment Method (Now)

```bash
# Check payment method status
1. AWS Console → Billing → Payment methods
2. Confirm UPI is "Active" and "Default"
3. If not default, set it as default
```

### Step 2: Request Bedrock Model Access (Now)

```bash
# Enable Claude 3 Haiku
1. AWS Console → Amazon Bedrock
2. Model access → Manage model access
3. Check "Anthropic Claude 3 Haiku"
4. Click "Request model access" or "Save changes"
5. Fill out use case if prompted
```

### Step 3: Wait for Token Limit Reset (Tomorrow 5:30 AM IST)

The token limit will automatically reset. No action needed.

### Step 4: Test After Reset (Tomorrow)

Once the limit resets and model access is approved:

```bash
# Update frontend to use real AWS
cd frontend
# Edit .env.local: NEXT_PUBLIC_DEMO_MODE=false
npm run dev

# Test upload
# Go to http://localhost:3000/document-scan-demo
# Upload a document
```

## Alternative: Add Credit/Debit Card

If UPI continues to have issues, add a credit/debit card as backup:

1. AWS Console → Billing → Payment methods
2. Click "Add a payment method"
3. Select "Credit or debit card"
4. Enter card details
5. Set as default
6. Wait 2-5 minutes

International cards (Visa, Mastercard, Amex) typically work better with AWS services than UPI.

## Check Current Status

### Verify Payment Method Status

```bash
# In AWS Console
1. Billing → Payment methods
2. Look for:
   - Status: "Active" ✅
   - Default: "Yes" ✅
   - Type: "UPI" or "Card"
```

### Verify Bedrock Model Access

```bash
# In AWS Console
1. Amazon Bedrock → Model access
2. Look for "Anthropic Claude 3 Haiku"
3. Status should be: "Access granted" ✅
```

### Check Token Limit Status

```bash
# You'll know the limit reset when:
1. Error changes from "Too many tokens" to something else
2. Or requests start succeeding
3. Happens at midnight UTC (5:30 AM IST)
```

## What to Do Right Now

### Option A: Wait for Tomorrow (Recommended)

1. Keep using Demo Mode for client presentation today
2. Tomorrow after 5:30 AM IST, token limit resets
3. Test real AWS integration then
4. Demo Mode works perfectly - no rush!

### Option B: Try to Fix Payment Now

1. Set UPI as default payment method
2. Request Bedrock model access
3. Add credit card as backup
4. Still need to wait for token limit reset tomorrow

## Cost After Payment Issue is Resolved

Once everything works:

- **Per document**: ₹0.03 (less than 1 rupee)
- **100 documents**: ₹3
- **1,000 documents**: ₹30

Very affordable! And Demo Mode remains free forever.

## Need More Help?

If none of these solutions work:

1. **AWS Support**: Go to AWS Console → Support → Create case
2. **Billing Support**: Available even on free tier
3. **Topic**: "Billing and payment method issues"
4. **Description**: "UPI payment active but getting INVALID_PAYMENT_INSTRUMENT error for Bedrock"

AWS support typically responds within 24 hours for billing issues.

## Summary

**Most Likely Issue**: Daily token limit (separate from payment)
**Solution**: Wait until tomorrow 5:30 AM IST for limit to reset
**Meanwhile**: Use Demo Mode - it works perfectly!
**After Reset**: Test real AWS integration
**Backup Plan**: Add credit/debit card if UPI continues having issues
