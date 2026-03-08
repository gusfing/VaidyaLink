# VaidyaLink Branch Protection Setup Script (PowerShell)
#
# This script configures branch protection rules for the VaidyaLink repository
# using the GitHub CLI (gh). It sets up protection for both 'main' and 'develop' branches.
#
# Prerequisites:
# - GitHub CLI (gh) installed: https://cli.github.com/
# - Authenticated with GitHub: gh auth login
# - Admin access to the repository
#
# Usage:
#   .\scripts\setup-branch-protection.ps1

$ErrorActionPreference = "Stop"

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Function to check if command exists
function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Info "Checking prerequisites..."

if (-not (Test-CommandExists "gh")) {
    Write-Error "GitHub CLI (gh) is not installed."
    Write-Host "Please install it from: https://cli.github.com/"
    exit 1
}

Write-Success "GitHub CLI is installed"

# Check if authenticated
try {
    gh auth status 2>&1 | Out-Null
    Write-Success "Authenticated with GitHub"
} catch {
    Write-Error "Not authenticated with GitHub."
    Write-Host "Please run: gh auth login"
    exit 1
}

# Get repository information
$repoOwner = gh repo view --json owner --jq .owner.login
$repoName = gh repo view --json name --jq .name

Write-Info "Repository: $repoOwner/$repoName"

# Confirm with user
Write-Host ""
Write-Warning "This script will configure branch protection rules for:"
Write-Host "  - main branch (production)"
Write-Host "  - develop branch (integration)"
Write-Host ""

$confirmation = Read-Host "Do you want to continue? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Info "Aborted by user"
    exit 0
}

# Function to set up branch protection
function Set-BranchProtection {
    param(
        [string]$Branch,
        [int]$RequiredReviews,
        [string]$RequiredChecks
    )

    Write-Info "Setting up protection for '$Branch' branch..."

    # Split checks into array
    $checksArray = $RequiredChecks -split ','

    # Build the API request
    $body = @{
        required_status_checks = @{
            strict = $true
            contexts = $checksArray
        }
        enforce_admins = $true
        required_pull_request_reviews = @{
            dismiss_stale_reviews = $true
            require_code_owner_reviews = $true
            required_approving_review_count = $RequiredReviews
        }
        required_linear_history = $true
        allow_force_pushes = $false
        allow_deletions = $false
        required_signatures = $true
    } | ConvertTo-Json -Depth 10

    try {
        # Create protection rule using GitHub API
        gh api `
            --method PUT `
            -H "Accept: application/vnd.github+json" `
            "/repos/$repoOwner/$repoName/branches/$Branch/protection" `
            --input - <<< $body 2>&1 | Out-Null

        Write-Success "Protection configured for '$Branch' branch"
        return $true
    } catch {
        Write-Error "Failed to configure protection for '$Branch' branch"
        Write-Warning "You may need admin access to the repository"
        return $false
    }
}

# Set up main branch protection
Write-Host ""
Write-Info "Configuring 'main' branch protection..."
$mainChecks = "ci/lint,ci/test-frontend,ci/test-backend,ci/security-scan,ci/build,ci/e2e"

if (Set-BranchProtection -Branch "main" -RequiredReviews 2 -RequiredChecks $mainChecks) {
    Write-Success "Main branch protection configured successfully"
    Write-Host "  - Required reviews: 2"
    Write-Host "  - Required checks: lint, test-frontend, test-backend, security-scan, build, e2e"
    Write-Host "  - Signed commits: required"
    Write-Host "  - Force push: disabled"
    Write-Host "  - Branch deletion: disabled"
} else {
    Write-Error "Failed to configure main branch protection"
}

# Set up develop branch protection
Write-Host ""
Write-Info "Configuring 'develop' branch protection..."
$developChecks = "ci/lint,ci/test-frontend,ci/test-backend,ci/build"

if (Set-BranchProtection -Branch "develop" -RequiredReviews 1 -RequiredChecks $developChecks) {
    Write-Success "Develop branch protection configured successfully"
    Write-Host "  - Required reviews: 1"
    Write-Host "  - Required checks: lint, test-frontend, test-backend, build"
    Write-Host "  - Signed commits: required"
    Write-Host "  - Force push: disabled"
    Write-Host "  - Branch deletion: disabled"
} else {
    Write-Error "Failed to configure develop branch protection"
}

# Summary
Write-Host ""
Write-Info "Branch protection setup complete!"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Verify protection rules on GitHub:"
Write-Host "     https://github.com/$repoOwner/$repoName/settings/branches"
Write-Host ""
Write-Host "  2. Set up required CI/CD workflows:"
Write-Host "     - Ensure .github/workflows/branch-protection.yml is configured"
Write-Host "     - Verify all required status checks are running"
Write-Host ""
Write-Host "  3. Configure CODEOWNERS file:"
Write-Host "     - Review and update CODEOWNERS file with team members"
Write-Host ""
Write-Host "  4. Enable commit signing for all team members:"
Write-Host "     - See docs/GIT_WORKFLOW.md for GPG setup instructions"
Write-Host ""
Write-Success "All done! 🎉"
