# Package Document Processor Lambda for deployment
# This script creates a deployment package with dependencies

Write-Host "[INFO] Packaging document processor Lambda..." -ForegroundColor Green

# Create build directory
$BUILD_DIR = "build"
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

# Install dependencies
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Green
pip install -r requirements.txt -t $BUILD_DIR --quiet

# Copy source code
Write-Host "[INFO] Copying source code..." -ForegroundColor Green
Copy-Item src/index.py $BUILD_DIR/

# Create deployment package
Write-Host "[INFO] Creating deployment package..." -ForegroundColor Green
$currentDir = Get-Location
Set-Location $BUILD_DIR
Compress-Archive -Path * -DestinationPath ../document-processor-lambda.zip -Force
Set-Location $currentDir

# Get package size
$size = (Get-Item document-processor-lambda.zip).Length / 1MB
$sizeFormatted = "{0:N2} MB" -f $size

Write-Host "[INFO] Package created: document-processor-lambda.zip ($sizeFormatted)" -ForegroundColor Green
Write-Host "[NOTE] Deploying to AWS Lambda..." -ForegroundColor Yellow
