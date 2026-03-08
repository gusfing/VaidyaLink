#!/bin/bash

# Update API Lambda with Cognito configuration
echo "Updating document-scan-api-dev Lambda with Cognito configuration..."

aws lambda update-function-configuration \
  --function-name document-scan-api-dev \
  --environment "Variables={JOBS_TABLE=document-scan-jobs-dev,DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,NODE_ENV=dev,S3_DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,COGNITO_USER_POOL_ID=us-east-1_iBVHMFnpa,AWS_REGION=us-east-1}" \
  --region ap-south-1

echo "Lambda configuration updated successfully!"
echo ""
echo "Note: The Lambda function is in ap-south-1 but will verify tokens from us-east-1 Cognito pool"
