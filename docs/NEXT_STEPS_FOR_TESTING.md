# Next Steps: Deploy Document Processor and Test

Python is now installed! Follow these steps to deploy the real AWS integration:

## Step 1: Package the Document Processor Lambda (2 minutes)

Open PowerShell and run:

```powershell
cd C:\Users\ks209\Downloads\VaidyaLink\backend\document-processor
./package.ps1
```

This will:

- Install Python dependencies (boto3, paddleocr, aws-xray-sdk, etc.)
- Create `document-processor-lambda.zip` (~150 MB)

## Step 2: Deploy to AWS Lambda (1 minute)

```powershell
aws lambda update-function-code --function-name document-scan-processor-dev --zip-file fileb://document-processor-lambda.zip --region ap-south-1
```

Wait 30 seconds for Lambda to update.

## Step 3: Switch Frontend to Real Mode (30 seconds)

Edit `frontend/.env.local` and change:

```env
# FROM:
NEXT_PUBLIC_DEMO_MODE=true

# TO:
NEXT_PUBLIC_DEMO_MODE=false
```

## Step 4: Restart Frontend Dev Server

In your frontend terminal:

1. Press `Ctrl+C` to stop the server
2. Run `npm run dev` to restart
3. Wait for "Ready in X seconds"

## Step 5: Test with Real Document Upload

1. Go to http://localhost:3000/document-scan-demo
2. Upload a prescription image
3. Click "Start Processing"
4. Watch the real-time processing status
5. See actual OCR results from AWS!

## What You'll See

- **Real S3 upload** to `document-scan-docs-dev-038208944386`
- **Real Lambda processing** with PaddleOCR
- **Real DynamoDB storage** in `document-scan-jobs-dev`
- **Real-time status updates** from AWS

## Estimated Total Time: 5 minutes

Ready to start? Run the commands above!
