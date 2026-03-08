# Enable Amazon Nova Pro Access in AWS Bedrock

## Prerequisites

Your AWS account needs:

1. ✅ Valid payment method (you already have UPI AutoPay configured)
2. ✅ AWS Marketplace permissions for your IAM user/role
3. ✅ Access to us-east-1 region

## Step 1: Grant AWS Marketplace Permissions

Your IAM user/role needs these AWS Marketplace permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-marketplace:Subscribe",
        "aws-marketplace:Unsubscribe",
        "aws-marketplace:ViewSubscriptions"
      ],
      "Resource": "*"
    }
  ]
}
```

### How to Add These Permissions:

1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Click "Users" in the left sidebar
3. Find and click your IAM user
4. Click "Add permissions" → "Attach policies directly"
5. Search for "AWSMarketplaceManageSubscriptions" (AWS managed policy)
6. Select it and click "Next" → "Add permissions"

**OR** create a custom inline policy with the JSON above.

## Step 2: Enable Nova Pro Model Access

### Option A: Automatic (Recommended - Easiest)

Just invoke the model once and AWS will automatically enable it:

1. Go to http://localhost:3000/document-scan-demo
2. Toggle OFF Demo Mode
3. Upload a medical document
4. The first invocation will automatically subscribe you to Nova Pro
5. Wait up to 15 minutes for subscription to complete
6. Subsequent calls will work immediately

### Option B: Manual (Console)

1. Go to AWS Bedrock Console: https://console.aws.amazon.com/bedrock/
2. **Switch to us-east-1 region** (top-right corner)
3. Click "Model access" in the left sidebar
4. Click "Manage model access" or "Modify model access"
5. Find "Nova Pro" in the list
6. Check the box next to it
7. Review the EULA and click "Submit"
8. Wait for status to change to "Access granted" (usually instant)

### Option C: Programmatic (CLI/SDK)

```bash
# Step 1: List available offers for Nova Pro
aws bedrock list-foundation-model-agreement-offers \
  --model-id us.amazon.nova-pro-v1:0 \
  --region us-east-1

# Step 2: Create agreement (use offerToken from step 1)
aws bedrock create-foundation-model-agreement \
  --model-id us.amazon.nova-pro-v1:0 \
  --offer-token <TOKEN_FROM_STEP_1> \
  --region us-east-1

# Step 3: Verify access
aws bedrock get-foundation-model-availability \
  --model-id us.amazon.nova-pro-v1:0 \
  --region us-east-1
```

## Step 3: Test the System

1. Start frontend: `cd frontend && npm run dev`
2. Go to http://localhost:3000/document-scan-demo
3. Toggle OFF Demo Mode
4. Upload a medical document (prescription, lab report, etc.)
5. Watch the processing status

## Current Configuration

Your Lambda is already configured with:

- ✅ Bedrock region: us-east-1
- ✅ Model ID: `us.amazon.nova-pro-v1:0`
- ✅ Nova API format support
- ✅ Deployed and ready

## Troubleshooting

### Error: AccessDeniedException

**Cause**: Missing AWS Marketplace permissions or model not enabled

**Solution**:

1. Add AWS Marketplace permissions (see Step 1)
2. Wait 2 minutes after adding permissions
3. Try again

### Error: INVALID_PAYMENT_INSTRUMENT

**Cause**: No valid payment method (but you already have UPI configured, so this shouldn't happen)

**Solution**: Verify payment method is active in AWS Billing Console

### First invocation takes 15 minutes

**Cause**: AWS is automatically subscribing you to the model in the background

**Solution**: Wait up to 15 minutes. Subsequent calls will be instant.

## Alternative Models

If Nova Pro has issues, you can try these alternatives (all available in us-east-1):

1. **Nova Lite** - Faster, cheaper, good for simpler tasks
   - Model ID: `us.amazon.nova-lite-v1:0`

2. **Nova Micro** - Fastest, most cost-effective
   - Model ID: `us.amazon.nova-micro-v1:0`

To switch models, just let me know and I'll update the code.

## Why Nova Pro?

Nova Pro is perfect for medical document processing because it has:

- ✅ Complex reasoning analysis
- ✅ Text extraction and understanding
- ✅ Multilingual support
- ✅ High accuracy for structured data extraction
- ✅ Serverless (no infrastructure management)
- ✅ Cross-region inference support

## References

- [AWS Bedrock Model Access Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Amazon Nova Models](https://aws.amazon.com/bedrock/nova/)
- [AWS Marketplace Permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html#model-access-permissions)
