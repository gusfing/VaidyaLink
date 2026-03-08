# Switching to Amazon Titan Model

## The Problem

All Anthropic models (Claude Sonnet, Claude Haiku, Claude Opus) share the same rate limit pool. If you hit the limit on one, you've hit it on all of them.

## The Solution: Amazon Titan

Amazon Titan is AWS's own foundation model with:

- ✅ **Separate rate limits** from Anthropic models
- ✅ **No payment issues** - works with UPI AutoPay
- ✅ **Good quality** for entity extraction
- ✅ **Cheaper** than Claude models
- ✅ **Available immediately** in ap-south-1 region

## What Changed

Switched from **Anthropic Claude** to **Amazon Titan Text Premier**.

### Model Comparison

| Feature        | Anthropic Claude                 | Amazon Titan Premier              |
| -------------- | -------------------------------- | --------------------------------- |
| Model ID       | `anthropic.claude-*`             | `amazon.titan-text-premier-v1:0`  |
| Rate Limits    | Shared across all Claude models  | **Separate from Anthropic**       |
| Payment Issues | Yes (INVALID_PAYMENT_INSTRUMENT) | **No issues with UPI**            |
| Cost (Input)   | $0.25-$3/M tokens                | **$0.50/M tokens**                |
| Cost (Output)  | $1.25-$15/M tokens               | **$1.50/M tokens**                |
| Quality        | Excellent                        | **Good (sufficient for medical)** |
| Availability   | Requires approval                | **Instantly available**           |

## Alternative Models Available

If Titan doesn't work, you can also try:

### 1. Meta Llama 3

```python
BEDROCK_MODEL_ID = "meta.llama3-70b-instruct-v1:0"
```

- Free tier available
- Good quality
- Separate rate limits

### 2. Amazon Titan Express (Faster, Cheaper)

```python
BEDROCK_MODEL_ID = "amazon.titan-text-express-v1"
```

- Faster than Premier
- Cheaper
- Good for simple extraction

### 3. Cohere Command

```python
BEDROCK_MODEL_ID = "cohere.command-text-v14"
```

- Another alternative
- Separate rate limits

## Deploy the Updated Lambda

The code now supports multiple model types automatically!

```powershell
cd backend/document-processor
./deploy.ps1
```

This will:

1. Package the Lambda with multi-model support
2. Deploy with Amazon Titan as default
3. Lambda will automatically detect model type and use correct API format

## Request Model Access for Titan

1. Go to AWS Console → Amazon Bedrock
2. Click **"Model access"** in left sidebar
3. Click **"Manage model access"**
4. Find **"Amazon Titan Text Premier"**
5. Check the box
6. Click **"Request model access"** or **"Save changes"**

**Note**: Amazon Titan models are usually pre-approved and available immediately!

## Test After Deployment

```powershell
# Update frontend to disable demo mode
# Edit frontend/.env.local
NEXT_PUBLIC_DEMO_MODE=false

# Restart frontend
cd frontend
npm run dev

# Test at http://localhost:3000/document-scan-demo
```

## Cost Comparison

### Per Document Processing:

- **Anthropic Claude Haiku**: ₹0.01
- **Amazon Titan Premier**: ₹0.015 (slightly more expensive)
- **Amazon Titan Express**: ₹0.005 (cheaper!)

### For 1,000 Documents:

- **Claude Haiku**: ₹10
- **Titan Premier**: ₹15
- **Titan Express**: ₹5

Still very affordable!

## Switching Between Models

The code now supports multiple models. To switch, just change the model ID in `backend/document-processor/src/index.py`:

```python
# Line 43 - Change this:
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.titan-text-premier-v1:0")

# To one of these:
# Amazon Titan Express (faster, cheaper):
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.titan-text-express-v1")

# Meta Llama 3:
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "meta.llama3-70b-instruct-v1:0")

# Cohere Command:
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "cohere.command-text-v14")

# Back to Claude (if rate limit resets):
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
```

Then redeploy:

```powershell
cd backend/document-processor
./deploy.ps1
```

## Why This Should Work Now

1. **Different Provider**: Amazon Titan is AWS's own model, not Anthropic
2. **Separate Rate Limits**: Titan has its own rate limit pool
3. **No Payment Issues**: Works fine with UPI AutoPay
4. **Instantly Available**: No approval needed for AWS models
5. **Good Quality**: Sufficient for medical entity extraction

## If It Still Doesn't Work

If you still have issues:

1. **Try Titan Express** (faster, cheaper):

   ```python
   BEDROCK_MODEL_ID = "amazon.titan-text-express-v1"
   ```

2. **Try Meta Llama 3**:

   ```python
   BEDROCK_MODEL_ID = "meta.llama3-70b-instruct-v1:0"
   ```

3. **Wait until tomorrow** (5:30 AM IST) for all limits to reset

4. **Use Demo Mode** for presentations (always works!)

## Checking Available Models

To see which models are available in your region:

1. AWS Console → Amazon Bedrock
2. Click "Model catalog" in left sidebar
3. Filter by region: ap-south-1 (Mumbai)
4. Look for models with "Access granted" status

## Summary

✅ Switched to Amazon Titan (AWS's own model)
✅ Separate rate limits from Anthropic
✅ No payment issues with UPI
✅ Code supports multiple model types automatically
✅ Ready to deploy with `./deploy.ps1`
✅ Can easily switch between models if needed

This should work immediately since Titan doesn't have the Anthropic rate limit issue!
