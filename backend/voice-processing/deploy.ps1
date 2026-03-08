#!/usr/bin/env pwsh
# Deploy Voice Processing Lambda with Sarvam API integration

Write-Host "=== Voice Processing Lambda Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$FUNCTION_NAME = "vaidyalink-voice-processing-dev"
$REGION = "ap-south-1"
$RUNTIME = "nodejs18.x"

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI is not installed" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Creating deployment package..." -ForegroundColor Yellow

# Create temp directory
$TEMP_DIR = "lambda-package"
if (Test-Path $TEMP_DIR) {
    Remove-Item -Recurse -Force $TEMP_DIR
}
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

# Copy source files
Write-Host "  - Copying source files..." -ForegroundColor Gray
Copy-Item -Recurse src/* $TEMP_DIR/

# Copy node_modules
Write-Host "  - Copying dependencies..." -ForegroundColor Gray
Copy-Item -Recurse node_modules $TEMP_DIR/

# Create ZIP file
Write-Host "  - Creating ZIP archive..." -ForegroundColor Gray
$ZIP_FILE = "voice-processing-lambda.zip"
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE
}

# Use PowerShell's Compress-Archive
Compress-Archive -Path "$TEMP_DIR/*" -DestinationPath $ZIP_FILE -CompressionLevel Optimal

# Get file size
$FILE_SIZE = (Get-Item $ZIP_FILE).Length / 1MB
Write-Host "  - Package size: $([math]::Round($FILE_SIZE, 2)) MB" -ForegroundColor Gray

# Clean up temp directory
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host "Step 3: Deploying to AWS Lambda..." -ForegroundColor Yellow

# Check if function exists
$FUNCTION_EXISTS = aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  - Updating existing function..." -ForegroundColor Gray
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --zip-file "fileb://$ZIP_FILE" `
        --region $REGION `
        --no-cli-pager

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to update Lambda function" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: Function $FUNCTION_NAME does not exist" -ForegroundColor Red
    Write-Host "Please create the function first using CDK or CloudFormation" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Function: $FUNCTION_NAME" -ForegroundColor Cyan
Write-Host "Region: $REGION" -ForegroundColor Cyan
Write-Host "Package: $ZIP_FILE ($([math]::Round($FILE_SIZE, 2)) MB)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set Sarvam API key in AWS Secrets Manager" -ForegroundColor White
Write-Host "   See: infrastructure/docs/SARVAM_API_KEY_SETUP.md" -ForegroundColor Gray
Write-Host "2. Test the function with a sample audio file" -ForegroundColor White
Write-Host "3. Monitor CloudWatch logs for any errors" -ForegroundColor White
Write-Host ""
