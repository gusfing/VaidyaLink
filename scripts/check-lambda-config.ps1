# Check Document Processor Lambda Configuration

Write-Host "[INFO] Checking Lambda configuration..." -ForegroundColor Green

aws lambda get-function-configuration `
    --function-name document-scan-processor-dev `
    --region ap-south-1 `
    --query '{Timeout:Timeout,Memory:MemorySize,Runtime:Runtime,LastModified:LastModified,CodeSize:CodeSize}' `
    --output table

Write-Host "`n[INFO] Environment Variables:" -ForegroundColor Yellow
aws lambda get-function-configuration `
    --function-name document-scan-processor-dev `
    --region ap-south-1 `
    --query 'Environment.Variables' `
    --output table
