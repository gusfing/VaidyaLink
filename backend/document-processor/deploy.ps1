# Lambda packaging and deployment script
Write-Host "=== Lambda Packaging ===" -ForegroundColor Cyan

# Find Python
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $null = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $cmd
            break
        }
    } catch { }
}

if (-not $pythonCmd) {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Using: $pythonCmd" -ForegroundColor Green

# Clean
if (Test-Path build) { Remove-Item -Recurse -Force build }
New-Item -ItemType Directory -Path build | Out-Null

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt -t build

# Copy source
Copy-Item src/index.py build/

# Create ZIP
Write-Host "Creating ZIP..." -ForegroundColor Yellow
$currentDir = Get-Location
Set-Location build
if (Test-Path ../document-processor-lambda.zip) {
    Remove-Item ../document-processor-lambda.zip
}
Compress-Archive -Path * -DestinationPath ../document-processor-lambda.zip -CompressionLevel Fastest
Set-Location $currentDir

$zipSize = (Get-Item document-processor-lambda.zip).Length / 1MB
Write-Host "Package size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green

if ($zipSize -lt 5) {
    Write-Host "ERROR: Package too small!" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "Deploying to AWS..." -ForegroundColor Yellow
aws lambda update-function-code --function-name document-scan-processor-dev --zip-file fileb://document-processor-lambda.zip --region ap-south-1 | Out-Null

Write-Host "DONE!" -ForegroundColor Green
