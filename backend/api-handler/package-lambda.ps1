# Package Lambda for deployment
Write-Host "Packaging API Lambda..." -ForegroundColor Cyan

# Clean up
if (Test-Path lambda-package) { Remove-Item -Recurse -Force lambda-package }
if (Test-Path lambda-package.zip) { Remove-Item lambda-package.zip }

# Create package directory
New-Item -ItemType Directory -Path lambda-package | Out-Null

# Copy source code
Copy-Item -Path src -Destination lambda-package/src -Recurse

# Copy package.json
Copy-Item -Path package.json -Destination lambda-package/

# Install dependencies in package directory
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location lambda-package
npm install --omit=dev --legacy-peer-deps
Set-Location ..

# Create zip
Write-Host "Creating zip file..." -ForegroundColor Yellow
Compress-Archive -Path lambda-package/* -DestinationPath lambda-package.zip

# Deploy
Write-Host "Deploying to AWS..." -ForegroundColor Yellow
aws lambda update-function-code `
  --function-name document-scan-api-dev `
  --zip-file fileb://lambda-package.zip `
  --region ap-south-1

Write-Host "✅ Deployment complete!" -ForegroundColor Green
