# Cleanup and Deploy Script for VaidyaLink
# This script cleans up failed resources and redeploys the stack

Write-Host "Step 1: Deleting DynamoDB tables..." -ForegroundColor Yellow

aws dynamodb delete-table --table-name vaidyalink-scanjobs-dev --region us-east-1 2>$null
aws dynamodb delete-table --table-name vaidyalink-patients-dev --region us-east-1 2>$null
aws dynamodb delete-table --table-name vaidyalink-voicejobs-dev --region us-east-1 2>$null

Write-Host "Step 2: Deleting S3 bucket..." -ForegroundColor Yellow

aws s3 rb s3://vaidyalink-documents-dev-038208944386 --force --region us-east-1 2>$null

Write-Host "Step 3: Waiting for rollback to complete..." -ForegroundColor Yellow

aws cloudformation wait stack-rollback-complete --stack-name vaidyalink-dev --region us-east-1

Write-Host "Step 4: Deleting failed stack..." -ForegroundColor Yellow

aws cloudformation delete-stack --stack-name vaidyalink-dev --region us-east-1

Write-Host "Step 5: Waiting for stack deletion..." -ForegroundColor Yellow

aws cloudformation wait stack-delete-complete --stack-name vaidyalink-dev --region us-east-1

Write-Host "Step 6: Waiting 30 seconds for resources to fully delete..." -ForegroundColor Yellow

Start-Sleep -Seconds 30

Write-Host "Step 7: Deploying fresh stack..." -ForegroundColor Green

pnpm cdk deploy VaidyaLink-dev

Write-Host "Done!" -ForegroundColor Green
