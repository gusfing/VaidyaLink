# Deploy Document Scan Demo Infrastructure
# This script deploys the AWS infrastructure for document-scan-demo

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',

    [Parameter(Mandatory=$false)]
    [string]$SarvamApiKey = '',

    [Parameter(Mandatory=$false)]
    [switch]$AutoApprove,

    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Display usage
function Show-Usage {
    Write-Host @"
Usage: .\deploy-document-scan-demo.ps1 [OPTIONS]

Deploy Document Scan Demo infrastructure to AWS

OPTIONS:
    -Environment ENV       Environment to deploy (dev, staging, prod). Default: dev
    -SarvamApiKey KEY     Sarvam API key to store in Secrets Manager
    -AutoApprove          Auto-approve deployment without confirmation
    -Help                 Display this help message

EXAMPLES:
    # Deploy to development
    .\deploy-document-scan-demo.ps1 -Environment dev -SarvamApiKey "your-api-key"

    # Deploy to production with auto-approval
    .\deploy-document-scan-demo.ps1 -Environment prod -SarvamApiKey "your-api-key" -AutoApprove

    # Deploy without setting API key (can be set later)
    .\deploy-document-scan-demo.ps1 -Environment dev

"@
    exit 0
}

if ($Help) {
    Show-Usage
}

Write-Info "Starting deployment for environment: $Environment"

# Check if AWS CLI is installed
try {
    $null = Get-Command aws -ErrorAction Stop
} catch {
    Write-Error-Custom "AWS CLI is not installed. Please install it first."
    exit 1
}

# Check if CDK is installed
try {
    $null = Get-Command cdk -ErrorAction Stop
} catch {
    Write-Error-Custom "AWS CDK is not installed. Please install it: npm install -g aws-cdk"
    exit 1
}

# Check AWS credentials
Write-Info "Checking AWS credentials..."
try {
    $identity = aws sts get-caller-identity | ConvertFrom-Json
    $accountId = $identity.Account
    $region = aws configure get region

    Write-Info "AWS Account: $accountId"
    Write-Info "AWS Region: $region"
} catch {
    Write-Error-Custom "AWS credentials not configured. Please run 'aws configure'"
    exit 1
}

# Navigate to infrastructure directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

# Install dependencies
Write-Info "Installing dependencies..."
npm install

# Bootstrap CDK if needed
Write-Info "Checking CDK bootstrap status..."
try {
    $null = aws cloudformation describe-stacks --stack-name CDKToolkit 2>$null
} catch {
    Write-Warning-Custom "CDK not bootstrapped. Bootstrapping now..."
    cdk bootstrap "aws://$accountId/$region"
}

# Deploy the stack
Write-Info "Deploying infrastructure..."
if ($AutoApprove) {
    cdk deploy "VaidyaLink-$Environment" --require-approval never
} else {
    cdk deploy "VaidyaLink-$Environment"
}

# Store Sarvam API key if provided
if ($SarvamApiKey) {
    Write-Info "Storing Sarvam API key in Secrets Manager..."

    $secretName = "document-scan/sarvam-api-key-$Environment"
    $secretValue = @{ apiKey = $SarvamApiKey } | ConvertTo-Json -Compress

    # Check if secret exists
    try {
        $null = aws secretsmanager describe-secret --secret-id $secretName 2>$null
        # Update existing secret
        aws secretsmanager update-secret --secret-id $secretName --secret-string $secretValue
        Write-Info "Updated existing secret: $secretName"
    } catch {
        # Create new secret
        aws secretsmanager create-secret `
            --name $secretName `
            --description "Sarvam API key for document-scan-demo" `
            --secret-string $secretValue
        Write-Info "Created new secret: $secretName"
    }
} else {
    Write-Warning-Custom "No Sarvam API key provided. You can set it later with:"
    Write-Warning-Custom "  aws secretsmanager update-secret --secret-id document-scan/sarvam-api-key-$Environment --secret-string '{`"apiKey`":`"YOUR_KEY`"}'"
}

# Get stack outputs
Write-Info "Retrieving stack outputs..."
$outputs = aws cloudformation describe-stacks `
    --stack-name "VaidyaLink-$Environment" `
    --query 'Stacks[0].Outputs' `
    --output json | ConvertFrom-Json

# Extract important values
$documentBucket = ($outputs | Where-Object { $_.OutputKey -eq "DocumentScanDocumentsBucketName" }).OutputValue
$audioBucket = ($outputs | Where-Object { $_.OutputKey -eq "DocumentScanAudioBucketName" }).OutputValue
$jobsTable = ($outputs | Where-Object { $_.OutputKey -eq "DocumentScanJobsTableName" }).OutputValue
$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "RestApiUrl" }).OutputValue

# Display deployment summary
Write-Info "=========================================="
Write-Info "Deployment Complete!"
Write-Info "=========================================="
Write-Host ""
Write-Info "Environment: $Environment"
Write-Info "Region: $region"
Write-Host ""
Write-Info "Resources Created:"
Write-Info "  Documents Bucket: $documentBucket"
Write-Info "  Audio Bucket: $audioBucket"
Write-Info "  Jobs Table: $jobsTable"
Write-Info "  API URL: $apiUrl"
Write-Host ""
Write-Info "Next Steps:"
Write-Info "  1. Update frontend .env.local with these values"
Write-Info "  2. Deploy Lambda functions for document and voice processing"
Write-Info "  3. Test the integration with a sample upload"
Write-Host ""
Write-Info "Frontend Configuration:"
Write-Host "NEXT_PUBLIC_API_URL=$apiUrl"
Write-Host "NEXT_PUBLIC_AWS_REGION=$region"
Write-Host "NEXT_PUBLIC_DOCUMENT_BUCKET=$documentBucket"
Write-Host "NEXT_PUBLIC_AUDIO_BUCKET=$audioBucket"
Write-Host "NEXT_PUBLIC_DEMO_MODE=false"
Write-Host ""
Write-Info "=========================================="
