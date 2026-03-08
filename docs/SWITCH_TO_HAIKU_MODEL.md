# Switching to Claude 3 Haiku Model

## What Changed

Switched from **Claude 3.5 Sonnet v2** to **Claude 3 Haiku** to potentially avoid token limits and reduce costs.

### Model Comparison

| Feature       | Claude 3.5 Sonnet v2                        | Claude 3 Haiku                           |
| ------------- | ------------------------------------------- | ---------------------------------------- |
| Model ID      | `anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-haiku-20240307-v1:0` |
| Speed         | Slower                                      | **Much Faster**                          |
| Cost (Input)  | ~$3/M tokens                                | **~$0.25/M tokens** (12x cheaper!)       |
| Cost (Output) | ~$15/M tokens                               | **~$1.25/M tokens** (12x cheaper!)       |
| Quality       | Highest                                     | Good (sufficient for entity extraction)  |
| Token Limits  | May have hit daily limit                    | **Separate limit pool**                  |

## Why This Helps

1. **Different Rate Limit Pool**: Haiku has its own separate rate limits from Sonnet
2. **Much Cheaper**: 12x cheaper per token
3. **Faster**: Processes documents much quicker
4. **Good Enough**: For medical entity extraction, Haiku is more than sufficient

## Cost Savings

### Before (Claude 3.5 Sonnet v2):

- Per document: ~₹0.12
- 100 documents: ~₹12
- 1,000 documents: ~₹120

### After (Claude 3 Haiku):

- Per document: **~₹0.01** (12x cheaper!)
- 100 documents: **~₹1**
- 1,000 documents: **~₹10**

## Deploy the Updated Lambda

Run this command to deploy the updated Lambda with Haiku:

```powershell
cd backend/document-processor
./deploy.ps1
```

This will:

1. Package the Lambda with updated model ID
2. Deploy to AWS
3. Lambda will now use Claude 3 Haiku instead of Sonnet

## Request Model Access for Haiku

1. Go to AWS Console → Amazon Bedrock
2. Click **"Model access"** in left sidebar
3. Click **"Manage model access"**
4. Find **"Anthropic Claude 3 Haiku"**
5. Check the box
6. Click **"Request model access"** or **"Save changes"**

Should be approved instantly!

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

## If It Still Doesn't Work

If you still get rate limit errors:

1. **Wait a few hours** - Haiku has separate limits but they still reset daily
2. **Try tomorrow morning** after 5:30 AM IST
3. **Use Demo Mode** for presentations (always works, no costs)

## Reverting Back to Sonnet

If you want to switch back to Sonnet later:

1. Edit `backend/document-processor/src/index.py`
2. Change line 43 to:
   ```python
   BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
   ```
3. Run `./deploy.ps1` again

## Summary

✅ Switched to Claude 3 Haiku (12x cheaper, faster)
✅ Has separate rate limits from Sonnet
✅ Good quality for medical entity extraction
✅ Ready to deploy with `./deploy.ps1`
