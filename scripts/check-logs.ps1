# Check Lambda logs quickly
$stream = aws logs describe-log-streams --log-group-name /aws/lambda/document-scan-processor-dev --order-by LastEventTime --descending --max-items 1 --region ap-south-1 --query 'logStreams[0].logStreamName' --output text

if ($stream) {
    Write-Host "Latest logs:" -ForegroundColor Yellow
    aws logs get-log-events --log-group-name /aws/lambda/document-scan-processor-dev --log-stream-name $stream --region ap-south-1 --query 'events[-20:].message' --output text
}
