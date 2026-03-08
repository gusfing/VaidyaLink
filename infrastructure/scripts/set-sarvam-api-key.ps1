# PowerShell script to set Sarvam API key in AWS Secrets Manager
# Usage: .\set-sarvam-api-key.ps1 -Environment <env> -ApiKey <key>

param(
    [Parameter(Mandatory=$true)]
    [string]$Environment,

    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$SecretName = "document-scan/sarvam-api-key-$Environment"

Write-Host "Setting Sarvam API key for environment: $Environment" -ForegroundColor Cyan
Write-Host "Secret name: $SecretName" -ForegroundColor Cyan

# Create JSON payload
$SecretValue = @{
    apiKey = $ApiKey
} | ConvertTo-Json -Compress

try {
    # Update the secret
    aws secretsmanager update-secret `
        --secret-id $SecretName `
        --secret-string $SecretValue `
        --region $Region

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully updated Sarvam API key in Secrets Manager" -ForegroundColor Green

        # Get and display the secret ARN
        $SecretArn = aws secretsmanager describe-secret `
            --secret-id $SecretName `
            --query 'ARN' `
            --output text `
            --region $Region

        Write-Host "Secret ARN: $SecretArn" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to update secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    exit 1
}
