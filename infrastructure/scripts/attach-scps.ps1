# Script to attach Service Control Policies to OUs and Accounts
# Run this after deploying the Organizations stack

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'prod'
)

$ErrorActionPreference = "Continue"

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

function Get-StackOutput {
    param(
        [string]$StackName,
        [string]$OutputKey
    )

    $output = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" `
        --output text

    return $output
}

# Main script
$stackName = "vaidyalink-$Environment"

Write-Info "Attaching Service Control Policies for $Environment environment..."

# Get policy and OU IDs from stack outputs
Write-Info "Retrieving stack outputs..."

$baseSCPId = Get-StackOutput -StackName $stackName -OutputKey "BaseSCPId"
$hipaaSCPId = Get-StackOutput -StackName $stackName -OutputKey "HIPAASCPId"
$workloadsOUId = Get-StackOutput -StackName $stackName -OutputKey "WorkloadsOUId"
$securityOUId = Get-StackOutput -StackName $stackName -OutputKey "SecurityOUId"

if (-not $baseSCPId -or -not $hipaaSCPId) {
    Write-Error-Custom "Could not retrieve policy IDs from stack outputs"
    Write-Error-Custom "Make sure the Organizations stack is deployed"
    exit 1
}

Write-Info "Base SCP ID: $baseSCPId"
Write-Info "HIPAA SCP ID: $hipaaSCPId"
Write-Info "Workloads OU ID: $workloadsOUId"
Write-Info "Security OU ID: $securityOUId"

# Attach Base SCP to Workloads OU
Write-Info "Attaching Base SCP to Workloads OU..."
try {
    aws organizations attach-policy --policy-id $baseSCPId --target-id $workloadsOUId 2>$null
    Write-Info "✓ Base SCP attached to Workloads OU"
} catch {
    Write-Warning-Custom "Base SCP may already be attached to Workloads OU"
}

# Attach Base SCP to Security OU
Write-Info "Attaching Base SCP to Security OU..."
try {
    aws organizations attach-policy --policy-id $baseSCPId --target-id $securityOUId 2>$null
    Write-Info "✓ Base SCP attached to Security OU"
} catch {
    Write-Warning-Custom "Base SCP may already be attached to Security OU"
}

# Get account IDs
$stagingAccountId = Get-StackOutput -StackName $stackName -OutputKey "StagingAccountId"
$prodAccountId = Get-StackOutput -StackName $stackName -OutputKey "ProdAccountId"

# Attach HIPAA SCP to Staging Account
if ($stagingAccountId) {
    Write-Info "Attaching HIPAA SCP to Staging Account ($stagingAccountId)..."
    try {
        aws organizations attach-policy --policy-id $hipaaSCPId --target-id $stagingAccountId 2>$null
        Write-Info "✓ HIPAA SCP attached to Staging Account"
    } catch {
        Write-Warning-Custom "HIPAA SCP may already be attached to Staging Account"
    }
}

# Attach HIPAA SCP to Production Account
if ($prodAccountId) {
    Write-Info "Attaching HIPAA SCP to Production Account ($prodAccountId)..."
    try {
        aws organizations attach-policy --policy-id $hipaaSCPId --target-id $prodAccountId 2>$null
        Write-Info "✓ HIPAA SCP attached to Production Account"
    } catch {
        Write-Warning-Custom "HIPAA SCP may already be attached to Production Account"
    }
}

Write-Info "SCP attachment completed!"
Write-Host ""
Write-Info "To verify attachments, run:"
Write-Host "  aws organizations list-policies-for-target --target-id $workloadsOUId --filter SERVICE_CONTROL_POLICY"
