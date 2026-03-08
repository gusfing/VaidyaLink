# How to Add Payment Method to AWS Account

## Problem

You're seeing this error when trying to use Amazon Bedrock:

```
AccessDeniedException: Model access is denied due to INVALID_PAYMENT_INSTRUMENT
```

This means your AWS account doesn't have a valid payment method configured.

## Solution: Add Payment Method

### Step 1: Sign in to AWS Console

1. Go to https://console.aws.amazon.com/
2. Sign in with your AWS account credentials

### Step 2: Navigate to Billing Dashboard

1. Click on your account name in the top-right corner
2. Select **"Billing and Cost Management"** from the dropdown menu
   - Or go directly to: https://console.aws.amazon.com/billing/

### Step 3: Add Payment Method

1. In the left sidebar, click **"Payment methods"**
2. Click the **"Add a payment method"** button
3. Choose your payment method type:
   - **Credit/Debit Card** (most common)
   - **Bank Account** (ACH - US only)

### Step 4: Enter Payment Details

#### For Credit/Debit Card:

- Card number
- Expiration date (MM/YY)
- Cardholder name
- Billing address
- CVV/Security code

#### For Bank Account (US only):

- Bank account number
- Routing number
- Account holder name

### Step 5: Set as Default (Important!)

1. After adding the payment method, make sure it's set as **default**
2. Look for a "Set as default" option or checkbox
3. This ensures AWS uses this payment method for all charges

### Step 6: Verify Payment Method

1. AWS may charge a small verification amount ($1-2)
2. This will be refunded automatically
3. Check your card/bank statement to confirm the charge appears

## After Adding Payment Method

### Wait 2-5 Minutes

AWS needs time to process and verify your payment method. Wait at least 2-5 minutes before trying Bedrock again.

### Test Bedrock Access

After waiting, try accessing Bedrock again:

1. Go to AWS Console → Amazon Bedrock
2. Navigate to "Model access" in the left sidebar
3. You should see models are now available
4. Try invoking a model through your Lambda function

## Enable Bedrock Models

### Step 1: Go to Bedrock Console

1. In AWS Console, search for "Bedrock"
2. Click on **Amazon Bedrock**
3. Make sure you're in the correct region: **ap-south-1** (Mumbai)

### Step 2: Request Model Access (if needed)

1. Click **"Model access"** in the left sidebar
2. Click **"Manage model access"** or **"Request model access"**
3. Find **Anthropic Claude 3 Haiku**
4. Check the box next to it
5. Click **"Request model access"** or **"Save changes"**

**Note:** As of 2024, most Bedrock models are automatically enabled when you have a valid payment method. You may not need to manually request access.

### Step 3: Wait for Approval

- Most models are approved instantly
- Some models (like Anthropic Claude) may require use case submission
- Check the status - it should show "Access granted" in green

## Switch from Demo Mode to Real AWS

Once your payment method is added and Bedrock is working:

### Step 1: Update Frontend Environment

```bash
# Edit frontend/.env.local
NEXT_PUBLIC_DEMO_MODE=false
```

### Step 2: Restart Frontend

```bash
cd frontend
npm run dev
```

### Step 3: Test Real Processing

1. Go to http://localhost:3000/document-scan-demo
2. Upload a document
3. It should now use real AWS Bedrock AI instead of mock data

## Troubleshooting

### "Still getting INVALID_PAYMENT_INSTRUMENT error"

- Wait 5-10 minutes after adding payment method
- Verify the payment method is set as **default**
- Check if the card has sufficient funds/credit limit
- Try removing and re-adding the payment method

### "Too many tokens per day" error

- This is a separate issue from payment method
- AWS Bedrock free tier has daily limits
- Wait until midnight UTC for the limit to reset
- Or upgrade to a paid tier for higher limits

### "Model access denied" (different from payment error)

- Go to Bedrock Console → Model access
- Request access to the specific model you need
- Some models require use case submission

### Payment method verification failed

- Check card details are correct
- Ensure billing address matches card billing address
- Try a different card if available
- Contact your bank to ensure they're not blocking AWS charges

## Cost Estimates

### Amazon Bedrock Claude 3 Haiku Pricing (ap-south-1)

- **Input tokens**: ~$0.25 per 1M tokens
- **Output tokens**: ~$1.25 per 1M tokens

### Typical Document Processing Cost

- Average prescription: ~500 input tokens, ~200 output tokens
- **Cost per document**: ~$0.0004 (less than 1 cent)
- **100 documents**: ~$0.04
- **1,000 documents**: ~$0.40

### Free Tier

- AWS Free Tier includes some Bedrock usage
- Check current free tier limits at: https://aws.amazon.com/bedrock/pricing/

## Important Notes

1. **No charges without usage**: AWS only charges when you actually use services
2. **Set up billing alerts**: Recommended to avoid unexpected charges
3. **Monitor usage**: Check AWS Cost Explorer regularly
4. **Demo mode is free**: You can always use Demo Mode for presentations without any AWS costs

## Setting Up Billing Alerts (Recommended)

### Step 1: Enable Billing Alerts

1. Go to Billing Dashboard
2. Click "Billing preferences" in left sidebar
3. Check "Receive Billing Alerts"
4. Click "Save preferences"

### Step 2: Create CloudWatch Alarm

1. Go to CloudWatch Console
2. Click "Alarms" → "Create alarm"
3. Select "Billing" metric
4. Set threshold (e.g., $10)
5. Add your email for notifications
6. Create alarm

This way you'll get notified if costs exceed your expected amount.

## Need Help?

If you're still having issues after following these steps:

1. Check AWS Support Center: https://console.aws.amazon.com/support/
2. Contact AWS Support (available even on free tier for billing issues)
3. Or continue using Demo Mode for presentations - it works perfectly without any AWS costs!
