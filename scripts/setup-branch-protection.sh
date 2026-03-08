#!/bin/bash

# VaidyaLink Branch Protection Setup Script
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
#   ./scripts/setup-branch-protection.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists gh; then
    print_error "GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

print_success "GitHub CLI is installed"

# Check if authenticated
if ! gh auth status >/dev/null 2>&1; then
    print_error "Not authenticated with GitHub."
    echo "Please run: gh auth login"
    exit 1
fi

print_success "Authenticated with GitHub"

# Get repository information
REPO_OWNER=$(gh repo view --json owner --jq .owner.login)
REPO_NAME=$(gh repo view --json name --jq .name)

print_info "Repository: ${REPO_OWNER}/${REPO_NAME}"

# Confirm with user
echo ""
print_warning "This script will configure branch protection rules for:"
echo "  - main branch (production)"
echo "  - develop branch (integration)"
echo ""
read -p "Do you want to continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Aborted by user"
    exit 0
fi

# Function to set up branch protection
setup_branch_protection() {
    local BRANCH=$1
    local REQUIRED_REVIEWS=$2
    local REQUIRED_CHECKS=$3

    print_info "Setting up protection for '${BRANCH}' branch..."

    # Create protection rule using GitHub API
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        "/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
        -f required_status_checks[strict]=true \
        -f "required_status_checks[contexts][]=${REQUIRED_CHECKS}" \
        -f required_pull_request_reviews[dismiss_stale_reviews]=true \
        -f required_pull_request_reviews[require_code_owner_reviews]=true \
        -f "required_pull_request_reviews[required_approving_review_count]=${REQUIRED_REVIEWS}" \
        -f enforce_admins=true \
        -f required_linear_history=true \
        -f allow_force_pushes=false \
        -f allow_deletions=false \
        -f required_signatures=true \
        2>/dev/null

    if [ $? -eq 0 ]; then
        print_success "Protection configured for '${BRANCH}' branch"
    else
        print_error "Failed to configure protection for '${BRANCH}' branch"
        print_warning "You may need admin access to the repository"
        return 1
    fi
}

# Set up main branch protection
echo ""
print_info "Configuring 'main' branch protection..."
MAIN_CHECKS="ci/lint,ci/test-frontend,ci/test-backend,ci/security-scan,ci/build,ci/e2e"

if setup_branch_protection "main" 2 "$MAIN_CHECKS"; then
    print_success "Main branch protection configured successfully"
    echo "  - Required reviews: 2"
    echo "  - Required checks: lint, test-frontend, test-backend, security-scan, build, e2e"
    echo "  - Signed commits: required"
    echo "  - Force push: disabled"
    echo "  - Branch deletion: disabled"
else
    print_error "Failed to configure main branch protection"
fi

# Set up develop branch protection
echo ""
print_info "Configuring 'develop' branch protection..."
DEVELOP_CHECKS="ci/lint,ci/test-frontend,ci/test-backend,ci/build"

if setup_branch_protection "develop" 1 "$DEVELOP_CHECKS"; then
    print_success "Develop branch protection configured successfully"
    echo "  - Required reviews: 1"
    echo "  - Required checks: lint, test-frontend, test-backend, build"
    echo "  - Signed commits: required"
    echo "  - Force push: disabled"
    echo "  - Branch deletion: disabled"
else
    print_error "Failed to configure develop branch protection"
fi

# Summary
echo ""
print_info "Branch protection setup complete!"
echo ""
print_info "Next steps:"
echo "  1. Verify protection rules on GitHub:"
echo "     https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/branches"
echo ""
echo "  2. Set up required CI/CD workflows:"
echo "     - Ensure .github/workflows/branch-protection.yml is configured"
echo "     - Verify all required status checks are running"
echo ""
echo "  3. Configure CODEOWNERS file:"
echo "     - Review and update CODEOWNERS file with team members"
echo ""
echo "  4. Enable commit signing for all team members:"
echo "     - See docs/GIT_WORKFLOW.md for GPG setup instructions"
echo ""
print_success "All done! 🎉"
