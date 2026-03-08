# VaidyaLink AWS Organizations Deployment Script (PowerShell)
# This script helps deploy AWS Organizations infrastructure

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    # Check if AWS CLI is installed
    try {
        $null = aws --version
    } catch {
        Write-Error-Custom "AWS CLI is not installed. Please install it first."
        exit 1
    }

    # Check if CDK is installed
    try {
        $null = cdk --version
    } catch {
        Write-Error-Custom "AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
        exit 1
    }

    # Check AWS credentials
    try {
        $null = aws sts get-caller-identity
    } catch {
        Write-Error-Custom "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    }

    Write-Info "Prerequisites check passed!"
}

# Function to validate configuration
function Test-Configuration {
    param([string]$Env)

    $configFile = "config\$Env.json"

    Write-Info "Validating configuration for environment: $Env"

    if (-not (Test-Path $configFile)) {
        Write-Error-Custom "Configuration file not found: $configFile"
        exit 1
    }

    $config = Get-Content $configFile | ConvertFrom-Json

    # Check if organizations is enabled
    if ($config.organizations.enabled -ne $true) {
        Write-Warning-Custom "AWS Organizations is not enabled in $configFile"
        Write-Warning-Custom "Set 'organizations.enabled' to true to enable Organizations"
        exit 0
    }

    # Validate email addresses
    if (-not $config.organizations.accountEmails) {
        Write-Error-Custom "No account email addresses configured in $configFile"
        exit 1
    }

    Write-Info "Configuration validation passed!"
    return $config
}

# Function to display deployment plan
function Show-DeploymentPlan {
    param([string]$Env, [object]$Config)

    Write-Info "Deployment Plan for $Env environment:"
    Write-Host ""
    Write-Host "AWS Organization Structure:"
    Write-Host "  Root"
    Write-Host "  ├── Workloads OU"

    $emails = $Config.organizations.accountEmails

    if ($emails.dev) { Write-Host "  │   ├── VaidyaLink-Dev ($($emails.dev))" }
    if ($emails.staging) { Write-Host "  │   ├── VaidyaLink-Staging ($($emails.staging))" }
    if ($emails.prod) { Write-Host "  │   └── VaidyaLink-Prod ($($emails.prod))" }

    Write-Host "  └── Security OU"

    if ($emails.security) { Write-Host "      ├── VaidyaLink-Security ($($emails.security))" }
    if ($emails.logging) { Write-Host "      └── VaidyaLink-Logging ($($emails.logging))" }

    Write-Host ""
    Write-Host "Service Control Policies:"
    Write-Host "  - Base SCP (applied to all accounts)"
    Write-Host "  - HIPAA Compliance SCP (applied to staging and prod)"
    Write-Host ""
}

# Function to deploy Organizations
function Deploy-Organizations {
    param([string]$Env, [object]$Config)

    Write-Info "Deploying AWS Organizations for $Env environment..."

    # Bootstrap if needed
    Write-Info "Checking CDK bootstrap status..."
    $accountId = (aws sts get-caller-identity --query Account --output text)
    $region = $Config.region

    try {
        $null = aws cloudformation describe-stacks --stack-name CDKToolkit --region $region 2>&1
        Write-Info "CDK already bootstrapped"
    } catch {
        Write-Info "Bootstrapping CDK in account $accountId region $region..."
        cdk bootstrap "aws://$accountId/$region"
    }

    # Deploy the stack
    Write-Info "Deploying VaidyaLink-$Env stack..."
    cdk deploy "VaidyaLink-$Env" --context env=$Env --require-approval never

    Write-Info "Deployment completed successfully!"
}

# Function to show post-deployment steps
function Show-PostDeployment {
    Write-Info "Post-Depl
For detailed instructions, see: docs\ORGANIZATIONS_SETUP.md"
    Write-Host ""
}

# Main script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VaidyaLink AWS Organizations Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Change to infrastructure directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

# Run checks
Test-Prerequisites
$config = Test-Configuration -Env $Environment

# Show deployment plan
Show-DeploymentPlan -Env $Environment -Config $config

# Confirm deployment
Write-Warning-Custom "This will create AWS Organizations and member accounts."
Write-Warning-Custom "This action cannot be easily undone."
Write-Host ""
$confirm = Read-Host "Do you want to proceed? (yes/no)"

if ($confirm -ne "yes") {
    Write-Info "Deployment cancelled."
    exit 0
}

# Deploy
Deploy-Organizations -Env $Environment -Config $config

# Show next steps
Show-PostDeployment
