# Git Workflow Guide

## Overview

VaidyaLink follows a structured Git workflow to ensure code quality, maintain audit trails for healthcare compliance, and enable smooth collaboration across the development team. This document outlines our branching strategy, commit conventions, and branch protection rules.

## Branching Strategy

We use a **Git Flow** inspired branching model optimized for healthcare software development:

````
main (production)
  ↑
  └── release/* (release candidates)
        ↑
        └── develop (integration)
              ↑
              ├── feature/* (new features)
              ├── bugfix/* (b
rges must be via pull requests with 2+ approvals
- Must pass all CI/CD checks including security scans
- Requires signed commits for audit compliance

#### 2. `develop` - Integration Branch
- **Purpose**: Integration branch for ongoing development
- **Protection**: Moderate - requires approvals and passing tests
- **Deployment**: Auto-deploys to development environment
- **Naming**: `develop`
- **Lifetime**: Permanent

**Rules**:
- Direct commits are **discouraged** (use feature branches)
- Accepts merges from `feature/*`, `bugfix/*`, and `docs/*` branches
- Requires 1+ approval for merges
- Must pass all automated tests
- Code coverage must not decrease

#### 3. `feature/*` - Feature Branches
- **Purpose**: Development of new features
- **Base**: Created from `develop`
- **Merge Target**: `develop`
- **Naming**: `feature/task-number-short-description`
  - Example: `feature/8-document-processing-lambda`
  - Example: `feature/19-scanning-interface`
- **Lifetime**: Temporary (deleted after merge)

**Workflow**:
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/8-document-processing-lambda

# Work on feature
git add .
git commit -m "feat(document): implement OCR extraction pipeline"

# Push and create PR
git push origin feature/8-document-processing-lambda
````

#### 4. `bugfix/*` - Bug Fix Branches

- **Purpose**: Fix bugs found in development/staging
- **Base**: Created from `develop`
- **Merge Target**: `develop`
- **Naming**: `bugfix/issue-number-short-description`
  - Example: `bugfix/123-fix-fhir-validation-error`
- **Lifetime**: Temporary (deleted after merge)

#### 5. `hotfix/*` - Hotfix Branches

- **Purpose**: Urgent fixes for production issues
- **Base**: Created from `main`
- **Merge Target**: Both `main` AND `develop`
- **Naming**: `hotfix/issue-number-short-description`
  - Example: `hotfix/456-fix-abdm-auth-timeout`
- **Lifetime**: Temporary (deleted after merge)

**Workflow**:

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/456-fix-abdm-auth-timeout

# Fix the issue
git add .
git commit -m "fix(abdm): increase authentication timeout to 30s"

# Create PRs to both main and develop
git push origin hotfix/456-fix-abdm-auth-timeout
```

#### 6. `release/*` - Release Branches

- **Purpose**: Prepare for production release
- **Base**: Created from `develop`
- **Merge Target**: Both `main` AND `develop`
- **Naming**: `release/v{major}.{minor}.{patch}`
  - Example: `release/v1.0.0`
  - Example: `release/v1.2.0`
- **Lifetime**: Temporary (deleted after merge)

**Workflow**:

```bash
# Create release branch
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Update version numbers, changelog
# Only bug fixes allowed on release branch
git add .
git commit -m "chore(release): prepare v1.0.0"

# Create PRs to main and develop
git push origin release/v1.0.0
```

#### 7. `docs/*` - Documentation Branches

- **Purpose**: Documentation-only updates
- **Base**: Created from `develop`
- **Merge Target**: `develop`
- **Naming**: `docs/short-description`
  - Example: `docs/update-api-documentation`
- **Lifetime**: Temporary (deleted after merge)

## Commit Message Conventions

We follow the **Conventional Commits** specification for clear, structured commit history that supports automated changelog generation.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type       | Description                                       | Example                                                  |
| ---------- | ------------------------------------------------- | -------------------------------------------------------- |
| `feat`     | New feature                                       | `feat(voice): add Bhashini API integration`              |
| `fix`      | Bug fix                                           | `fix(fhir): correct medication dosage mapping`           |
| `docs`     | Documentation only                                | `docs(api): update REST endpoint documentation`          |
| `style`    | Code style changes (formatting, semicolons, etc.) | `style(frontend): apply Prettier formatting`             |
| `refactor` | Code refactoring without feature changes          | `refactor(lambda): extract OCR logic to separate module` |
| `perf`     | Performance improvements                          | `perf(db): add DynamoDB index for patient queries`       |
| `test`     | Adding or updating tests                          | `test(fhir): add unit tests for transformer`             |
| `build`    | Build system or dependencies                      | `build(deps): upgrade Next.js to 14.1.0`                 |
| `ci`       | CI/CD configuration changes                       | `ci(github): add security scanning workflow`             |
| `chore`    | Maintenance tasks                                 | `chore(deps): update AWS SDK`                            |
| `revert`   | Revert previous commit                            | `revert: revert "feat(voice): add Bhashini API"`         |

### Scopes

Common scopes for VaidyaLink:

- `frontend` - Next.js application
- `backend` - Lambda functions
- `document` - Document processing
- `voice` - Voice processing
- `fhir` - FHIR transformation
- `abdm` - ABDM integration
- `hitl` - Human-in-the-loop module
- `infra` - Infrastructure/CDK
- `api` - API Gateway
- `auth` - Authentication
- `db` - Database
- `security` - Security features
- `monitoring` - Monitoring/logging

### Examples

```bash
# Feature addition
git commit -m "feat(document): implement PaddleOCR integration for handwriting recognition"

# Bug fix with issue reference
git commit -m "fix(abdm): resolve consent revocation timeout

Increased timeout from 5s to 10s to handle ABDM API latency.

Fixes #234"

# Breaking change
git commit -m "feat(api)!: change authentication to use Cognito tokens

BREAKING CHANGE: API now requires Cognito JWT tokens instead of API keys.
Clients must update authentication headers."

# Documentation
git commit -m "docs(readme): add deployment instructions for AWS CDK"

# Performance improvement
git commit -m "perf(lambda): reduce cold start time by 40%

- Implemented Lambda layers for shared dependencies
- Optimized import statements
- Added connection pooling"
```

### Commit Message Rules

1. **Use imperative mood**: "add feature" not "added feature"
2. **Capitalize first letter**: "Add feature" not "add feature"
3. **No period at the end**: "Add feature" not "Add feature."
4. **Keep subject line under 72 characters**
5. **Separate subject from body with blank line**
6. **Wrap body at 72 characters**
7. **Use body to explain what and why, not how**
8. **Reference issues and PRs in footer**: `Fixes #123`, `Closes #456`

### Healthcare Compliance Notes

For commits involving Protected Health Information (PHI) or security changes:

```bash
git commit -m "feat(security): implement field-level encryption for PHI

Added KMS encryption for patient names, ABHA IDs, and contact information.

Security-Impact: HIGH
Compliance: HIPAA, ABDM
Reviewed-By: @security-team"
```

## Pull Request Process

### Creating a Pull Request

1. **Ensure your branch is up to date**:

```bash
git checkout develop
git pull origin develop
git checkout your-feature-branch
git rebase develop
```

2. **Push your branch**:

```bash
git push origin your-feature-branch
```

3. **Create PR on GitHub** with the following:
   - **Title**: Follow commit convention format
   - **Description**: Use the PR template (see below)
   - **Labels**: Add appropriate labels (feature, bugfix, documentation, etc.)
   - **Reviewers**: Request reviews from relevant team members
   - **Linked Issues**: Reference related issues

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Feature (new functionality)
- [ ] Bug fix (fixes an issue)
- [ ] Hotfix (urgent production fix)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring
- [ ] Security fix

## Related Issues

Fixes #123
Related to #456

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Healthcare Compliance

- [ ] No PHI in logs or error messages
- [ ] Encryption applied where required
- [ ] Audit logging implemented
- [ ] HIPAA compliance verified
- [ ] ABDM standards followed

## Deployment Notes

Any special deployment considerations or migration steps

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings introduced
- [ ] Dependent changes merged
```

### Review Process

#### For `develop` branch merges:

- **Required approvals**: 1
- **Required checks**: All CI/CD tests must pass
- **Review focus**: Code quality, test coverage, functionality

#### For `main` branch merges:

- **Required approvals**: 2 (including 1 from tech lead)
- **Required checks**: All CI/CD tests + security scan + performance tests
- **Review focus**: Production readiness, security, compliance

### Merge Strategy

- **Feature/Bugfix → Develop**: Squash and merge (clean history)
- **Release/Hotfix → Main**: Merge commit (preserve release history)
- **Hotfix → Develop**: Merge commit (preserve fix history)

## Branch Protection Rules

### Protection for `main` Branch

Configure these settings on GitHub:

1. **Require pull request reviews before merging**
   - Required approving reviews: **2**
   - Dismiss stale pull request approvals when new commits are pushed: **Yes**
   - Require review from Code Owners: **Yes**

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging: **Yes**
   - Required status checks:
     - ✅ `ci/lint` - ESLint and Prettier checks
     - ✅ `ci/test-frontend` - Frontend unit tests
     - ✅ `ci/test-backend` - Backend unit tests
     - ✅ `ci/security-scan` - OWASP dependency check
     - ✅ `ci/build` - Build verification
     - ✅ `ci/e2e` - End-to-end tests

3. **Require signed commits**: **Yes** (for audit compliance)

4. **Require linear history**: **Yes** (no merge commits from features)

5. **Include administrators**: **Yes** (rules apply to everyone)

6. **Restrict who can push to matching branches**
   - Allowed: Release managers only

7. **Allow force pushes**: **No**

8. **Allow deletions**: **No**

### Protection for `develop` Branch

1. **Require pull request reviews before merging**
   - Required approving reviews: **1**
   - Dismiss stale pull request approvals: **Yes**

2. **Require status checks to pass before merging**
   - Required status checks:
     - ✅ `ci/lint`
     - ✅ `ci/test-frontend`
     - ✅ `ci/test-backend`
     - ✅ `ci/build`

3. **Require signed commits**: **Yes**

4. **Allow force pushes**: **No**

5. **Allow deletions**: **No**

### Setting Up Branch Protection on GitHub

1. Go to repository **Settings** → **Branches**
2. Click **Add rule** under "Branch protection rules"
3. Enter branch name pattern: `main`
4. Configure settings as specified above
5. Click **Create** or **Save changes**
6. Repeat for `develop` branch

### Setting Up Branch Protection via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Authenticate
gh auth login

# Set protection for main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/lint","ci/test-frontend","ci/test-backend","ci/security-scan","ci/build","ci/e2e"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_signatures=true

# Set protection for develop branch
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/lint","ci/test-frontend","ci/test-backend","ci/build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_signatures=true
```

## Git Hooks

We use Husky to enforce code quality before commits and pushes.

### Pre-commit Hook

Already configured in `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged for automatic linting and formatting
npx lint-staged
```

### Pre-push Hook (Optional)

Create `.husky/pre-push` for additional checks:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests before pushing
pnpm test

# Check for sensitive data
git diff --cached --name-only | xargs grep -l "API_KEY\|SECRET\|PASSWORD" && echo "⚠️  Warning: Possible sensitive data detected" && exit 1

exit 0
```

## Code Owners

Create a `CODEOWNERS` file to automatically request reviews from specific team members:

```
# VaidyaLink Code Owners

# Default owners for everything
* @tech-lead @senior-dev

# Frontend
/frontend/ @frontend-team @ui-ux-lead

# Backend Lambda functions
/backend/ @backend-team @cloud-architect

# Infrastructure
/infrastructure/ @devops-team @cloud-architect

# Security-sensitive files
/backend/*/auth* @security-team
/infrastructure/security/ @security-team
*.env.example @security-team

# ABDM integration
/backend/abdm-connector/ @abdm-integration-team @compliance-officer

# FHIR transformation
/backend/fhir-transformer/ @healthcare-standards-team

# Documentation
/docs/ @tech-writer @tech-lead
*.md @tech-writer

# CI/CD
/.github/ @devops-team
```

## Tagging and Releases

### Semantic Versioning

VaidyaLink follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., API changes)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Creating a Release

1. **Create release branch**:

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
```

2. **Update version numbers**:
   - `package.json` in all workspaces
   - `CHANGELOG.md`
   - Any version constants in code

3. **Commit version bump**:

```bash
git add .
git commit -m "chore(release): bump version to 1.2.0"
```

4. **Create PR to main** and get approvals

5. **After merge, create Git tag**:

```bash
git checkout main
git pull origin main
git tag -a v1.2.0 -m "Release version 1.2.0

Features:
- Voice interface with Bhashini integration
- ABDM consent management
- Clinical summarization improvements

Bug Fixes:
- Fixed FHIR validation errors
- Resolved OCR timeout issues"

git push origin v1.2.0
```

6. **Merge back to develop**:

```bash
git checkout develop
git merge main
git push origin develop
```

7. **Create GitHub Release** with release notes

## Best Practices

### 1. Keep Commits Atomic

- One logical change per commit
- Easier to review and revert if needed

### 2. Write Descriptive Commit Messages

- Future you will thank present you
- Helps with debugging and understanding history

### 3. Rebase Before Merging

```bash
git checkout feature/my-feature
git fetch origin
git rebase origin/develop
```

### 4. Use Interactive Rebase to Clean History

```bash
git rebase -i HEAD~5  # Clean up last 5 commits
```

### 5. Never Commit Secrets

- Use `.env` files (already in `.gitignore`)
- Use AWS Secrets Manager for production secrets
- Use git-secrets tool to prevent accidental commits

### 6. Sign Your Commits

```bash
# Set up GPG key
gpg --gen-key

# Configure Git to use GPG key
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
```

### 7. Keep Branches Short-Lived

- Merge feature branches within 2-3 days
- Reduces merge conflicts
- Faster feedback cycles

### 8. Delete Merged Branches

```bash
# Delete local branch
git branch -d feature/my-feature

# Delete remote branch
git push origin --delete feature/my-feature
```

## Troubleshooting

### Merge Conflicts

```bash
# Update your branch
git checkout feature/my-feature
git fetch origin
git rebase origin/develop

# If conflicts occur
# 1. Resolve conflicts in your editor
# 2. Stage resolved files
git add .

# 3. Continue rebase
git rebase --continue

# If you want to abort
git rebase --abort
```

### Accidentally Committed to Wrong Branch

```bash
# Move commits to correct branch
git checkout correct-branch
git cherry-pick <commit-hash>

# Remove from wrong branch
git checkout wrong-branch
git reset --hard HEAD~1
```

### Need to Update PR After Review

```bash
# Make changes
git add .
git commit -m "fix(review): address review comments"

# Force push if you rebased
git push origin feature/my-feature --force-with-lease
```

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Husky Documentation](https://typicode.github.io/husky/)

## Questions?

For questions about the Git workflow, contact:

- **Tech Lead**: @tech-lead
- **DevOps Team**: @devops-team
- **Slack Channel**: #vaidyalink-dev
