# Simple Lambda packaging script with verbose output

Write-Host "=== Document Processor Lambda Packaging ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean build directory
Write-Host "[1/5] Cleaning build directory..." -ForegroundColor Yellow
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "  ✓ Removed old build directory" -ForegroundColor Green
}
New-Item -ItemType Directory -Path "build" | Out-Null
Write-Host "  ✓ Created fresh build directory" -ForegroundColor Green
Write-Host ""

# Step 2: Install Python dependencies
Write-Host "[2/5] Installing Python dependencies (this takes 2-3 minutes)..." -ForegroundColor Yellow
Write-Host "  Installing: boto3, paddleocr, aws-xray-sdk, etc." -ForegroundColor Gray

$installOutput = pip install -r requirements.txt -t build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ ERROR: pip install failed!" -ForegroundColor Red
    Write-Host $installOutput
    exit 1
}

Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Copy source code
Write-Host "[3/5] Copying source code..." -ForegroundColor Yellow
Copy-Item "src/index.py" "build/"
Write-Host "  ✓ Copied index.py" -ForegroundColor Green
Write-Host ""

# Step 4: Create ZIP file
Write-Host "[4/5] Creating deployment package..." -ForegroundColor Yellow
$currentDir = Get-Location
Set-Location "build"

if (Test-Path "../document-processor-lambda.zip") {
    Remove-Item "../document-processor-lambda.zip"
}

Compress-Archive -Path * -DestinationPath "../document-processor-lambda.zip" -CompressionLevel Fastest
Set-Location $currentDir

$zipSize = (Get-Item "document-processor-lambda.zip").Length
$zipSizeMB = [math]::Round($zipSize / 1MB, 2)

Write-Host "  ✓ Package created: document-processor-lambda.zip" -ForegroundColor Green
Write-Host "  ✓ Size: $zipSizeMB MB" -ForegroundColor Green

if ($zipSizeMB -lt 50) {
    Write-Host ""
    Write-Host "  ⚠ WARNING: Package size is too small ($zipSizeMB MB)" -ForegroundColor Red
    Write-Host "  Expected size: ~150 MB with all dependencies" -ForegroundColor Red
    Write-Host "  This means dependencies weren't installed properly!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Deploy to AWS
Write-Host "[5/5] Deploying to AWS Lambda..." -ForegroundColor Yellow
Write-Host "  Function: document-scan-processor-dev" -ForegroundColor Gray
Write-Host "  Region: ap-south-1" -ForegroundColor Gray
Write-Host ""

$deployOutput = aws lambda update-function-code `
    --function-name document-scan-processor-dev `
    --zip-file fileb://document-processor-lambda.zip `
    --region ap-south-1 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ ERROR: Deployment failed!" -ForegroundColor Red
    Write-Host $deployOutput
    exit 1
}

Write-Host "  ✓ Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait 30 seconds for Lambda to update"
Write-Host "2. Test document upload at http://localhost:3000/document-scan-demo"
Write-Host ""
