# Check Cognito User Pool Configuration
Write-Host "Checking Cognito User Pool Configuration..." -ForegroundColor Cyan

$userPoolId = "us-east-1_iBVHMFnpa"
$clientId = "1qijtglu44lbpu4leslq87tasq"
$region = "us-east-1"

Write-Host "`nUser Pool ID: $userPoolId" -ForegroundColor Yellow
Write-Host "Client ID: $clientId" -ForegroundColor Yellow
Write-Host "Region: $region" -ForegroundColor Yellow

# Check User Pool configuration
Write-Host "`n1. Checking User Pool settings..." -ForegroundColor Cyan
aws cognito-idp describe-user-pool --user-pool-id $userPoolId --region $region --query "UserPool.Policies.PasswordPolicy" --output json

# Check if self-registration is enabled
Write-Host "`n2. Checking self-registration..." -ForegroundColor Cyan
aws cognito-idp describe-user-pool --user-pool-id $userPoolId --region $region --query "UserPool.AdminCreateUserConfig.AllowAdminCreateUserOnly" --output text

# Check App Client configuration
Write-Host "`n3. Checking App Client configuration..." -ForegroundColor Cyan
aws cognito-idp describe-user-pool-client --user-pool-id $userPoolId --client-id $clientId --region $region --query "UserPoolClient.{ClientName:ClientName,ExplicitAuthFlows:ExplicitAuthFlows,ClientSecret:ClientSecret}" --output json

Write-Host "`n4. Checking if client has secret..." -ForegroundColor Cyan
$hasSecret = aws cognito-idp describe-user-pool-client --user-pool-id $userPoolId --client-id $clientId --region $region --query "UserPoolClient.ClientSecret" --output text

if ($hasSecret -ne "None") {
    Write-Host "❌ ERROR: App client has a client secret. Web apps should not use client secrets!" -ForegroundColor Red
    Write-Host "   You need to create a new app client without a secret." -ForegroundColor Yellow
} else {
    Write-Host "✅ App client does not have a secret (correct for web apps)" -ForegroundColor Green
}

Write-Host "`nConfiguration check complete." -ForegroundColor Cyan
