# Check Document Processor Lambda CloudWatch Logs
# This will show the most recent error

Write-Host "[INFO] Fetching latest CloudWatch logs for document-scan-processor-dev..." -ForegroundColor Green

# Get the log group
$LOG_GROUP = "/aws/lambda/document-scan-processor-dev"

# Get the latest log stream
$latestStream = aws logs describe-log-streams `
    --log-group-name $LOG_GROUP `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region ap-south-1 `
    --query 'logStreams[0].logStreamName' `
    --output text

if ($latestStream) {
    Write-Host "[INFO] Latest log stream: $latestStream" -ForegroundColor Cyan
    Write-Host "`n[INFO] Log entries:" -ForegroundColor Yellow

    # Get the log events
    aws logs get-log-events `
        --log-group-name $LOG_GROUP `
        --log-stream-name $latestStream `
        --region ap-south-1 `
        --query 'events[*].message' `
        --output text
} else {
    Write-Host "[ERROR] No log streams found" -ForegroundColor Red
}
