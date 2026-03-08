# Contributing to VaidyaLink

Thank you for your interest in contributing to VaidyaLink! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Healthcare Compliance](#healthcare-compliance)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and professional in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community and patients
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and **pnpm** 8+
- **Python** 3.11+ (for backend Lambda functions)
- **Docker** and **Docker Compose** (for local development)
- **Git** with GPG signing configured
- **AWS CLI** configured with appropriate credentials
- **awscli-local** (for LocalStack): `pip install awscli-local`
- **GitHub CLI** (optional, for branch protection setup)

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/vaidyalink.git
   cd vaidyalink
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/gusfing/vaidyalink.git
   ```

4. **Install dependencies**:

   ```bash
   pnpm install
   ```

5. **Set up local development environment**:

   ```bash
   # Start all services with Docker Compose
   bash scripts/dev.sh start

   # Or manually:
   docker-compose up -d

   # Wait for LocalStack to be ready
   bash scripts/localstack-setup.sh wait

   # Seed database with test data
   bash scripts/seed-database.sh
   ```

6. **Verify setup**:

   ```bash
   # Test LocalStack services
   bash scripts/localstack-setup.sh test

   # Check service status
   docker-compose ps
   ```

### Local Development Environment

VaidyaLink uses Docker Compose to run all services locally with hot reload enabled.

#### Available Services

Once started, you can access:

- **Frontend**: http://localhost:3000
- **LocalStack** (AWS emulation): http://localhost:4566
- **DynamoDB Admin UI**: http://localhost:8001
- **Mailhog** (email testing): http://localhost:8025
- **Redis**: localhost:6379

#### Lambda Functions (Local)

- **Document Processing**: http://localhost:9001
- **Voice Processing**: http://localhost:9002
- **Clinical Summarizer**: http://localhost:9003
- **FHIR Transformer**: http://localhost:9004
- **ABDM Connector**: http://localhost:9005
- **HITL Handler**: http://localhost:9006

#### Development Commands

```bash
# Start all services
bash scripts/dev.sh start

# Stop all services
bash scripts/dev.sh stop

# Restart all services
bash scripts/dev.sh restart

# View logs
bash scripts/dev.sh logs

# View logs for specific service
bash scripts/dev.sh logs frontend

# Rebuild services
bash scripts/dev.sh rebuild

# Run tests
bash scripts/dev.sh test

# Seed database
bash scripts/dev.sh seed

# Clean everything (removes all data)
bash scripts/dev.sh clean
```

#### Hot Reload

All services are configured with hot reload:

- **Frontend**: Changes to `frontend/` automatically reload
- **Lambda Functions**: Changes to `backend/*/` automatically reload
- **Infrastructure**: Changes require rebuild

#### VS Code Integration

The project includes VS Code configurations for debugging:

1. **Open workspace** in VS Code
2. **Install recommended extensions** (prompted automatically)
3. **Use debug configurations**:
   - `Next.js: Debug Server` - Debug frontend
   - `Python: Document Processing Lambda` - Debug Python Lambda
   - `Node: Voice Processing Lambda` - Debug Node.js Lambda
   - `Full Stack: Frontend + Backend` - Debug both

4. **Use tasks** (Ctrl+Shift+P → "Tasks: Run Task"):
   - `Build: All` - Build all projects
   - `Test: All` - Run all tests
   - `Lint: All` - Lint all code
   - `Docker: Start All Services` - Start Docker services
   - `LocalStack: Test` - Test LocalStack setup

#### Testing Locally

```bash
# Run all tests
pnpm test

# Run frontend tests
cd frontend && pnpm test

# Run Python Lambda tests
cd backend/document-processing && pytest

# Run with coverage
pnpm test --coverage

# Run E2E tests
cd frontend && pnpm test:e2e
```

#### Troubleshooting Local Setup

**LocalStack not starting:**

```bash
# Check Docker is running
docker ps

# Check LocalStack logs
docker-compose logs localstack

# Restart LocalStack
docker-compose restart localstack
```

**Port conflicts:**

```bash
# Check what's using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Stop the conflicting process or change port in docker-compose.yml
```

**Database not seeding:**

```bash
# Verify LocalStack is ready
bash scripts/localstack-setup.sh check

# Manually seed
bash scripts/seed-database.sh

# Check DynamoDB tables
awslocal dynamodb list-tables
```

**Lambda functions not responding:**

```bash
# Check Lambda container logs
docker-compose logs lambda-document-processing

# Restart specific Lambda
docker-compose restart lambda-document-processing

# Rebuild Lambda
docker-compose up -d --build lambda-document-processing
```

### Environment Variables

Create `.env.local` files in each service directory:

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_ENDPOINT=http://localhost:4566
NEXT_PUBLIC_WS_ENDPOINT=ws://localhost:4566
NEXT_PUBLIC_ENVIRONMENT=local
```

**Backend Lambdas** (already configured in docker-compose.yml):

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localstack:4566
ENVIRONMENT=local
LOG_LEVEL=debug
```

5. **Set up Git hooks**:

   ```bash
   pnpm prepare
   ```

6. **Verify setup**:
   ```bash
   pnpm lint
   pnpm test
   ```

For detailed Git workflow instructions, see:

- **[Git Quick Reference](docs/GIT_QUICK_REFERENCE.md)** - Common commands and daily workflows
- **[Git Workflow Guide](docs/GIT_WORKFLOW.md)** - Complete branching strategy and conventions

### Quick Workflow Summary

1. **Create a feature branch** from `develop`:

   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/123-your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Commit your changes** using conventional commits:

   ```bash
   git add .
   git commit -m "feat(scope): add new feature"
   ```

4. **Keep your branch updated**:

   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

5. **Push to your fork**:

   ```bash
   git push origin feature/123-your-feature-name
   ```

6. **Create a Pull Request** on GitHub

### Branch Naming Convention

```
<type>/<task-number>-<short-description>
```

**Examples**:

- `feature/8-document-processing-lambda`
- `bugfix/123-fix-fhir-validation`
- `hotfix/456-fix-abdm-timeout`
- `docs/update-api-documentation`

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes**: `frontend`, `backend`, `document`, `voice`, `fhir`, `abdm`, `hitl`, `infra`, `api`, `auth`, `db`, `security`, `monitoring`

**Examples**:

```bash
feat(frontend): add document scanning interface
fix(fhir): correct medication dosage mapping
docs(api): update REST endpoint documentation
```

## Coding Standards

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **ESLint** and **Prettier** configurations
- Use **functional components** and **hooks** in React
- Prefer **async/await** over promises
- Add **JSDoc comments** for complex functions
- Avoid `any` type - use proper TypeScript types

**Example**:

```typescript
/**
 * Processes a medical document and extracts structured data
 * @param imageUrl - S3 URL of the document image
 * @param patientId - Unique patient identifier
 * @returns Extracted clinical data with confidence scores
 */
async function processDocument(imageUrl: string, patientId: string): Promise<ExtractedData> {
  // Implementation
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** for function parameters and returns
- Use **Black** for formatting
- Use **Flake8** for linting
- Add **docstrings** for all functions and classes

**Example**:

```python
def extract_text_from_image(image_path: str) -> OCRResult:
    """
    Extract text from medical document image using PaddleOCR.

    Args:
        image_path: Path to the image file in S3

    Returns:
        OCRResult containing extracted text and confidence scores

    Raises:
        OCRException: If text extraction fails
    """
    # Implementation
```

### Code Organization

- **Keep files small**: Max 300 lines per file
- **Single responsibility**: One component/function per file
- **Meaningful names**: Use descriptive variable and function names
- **DRY principle**: Don't repeat yourself - extract common logic
- **Error handling**: Always handle errors gracefully

## Testing Guidelines

### Test Coverage Requirements

- **Minimum 80% code coverage** for all new code
- **Unit tests** for all functions and components
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows

### Writing Tests

**Frontend (Vitest/React Testing Library)**:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScannerComponent } from './Scanner';

describe('ScannerComponent', () => {
  it('should render camera interface', () => {
    render(<ScannerComponent />);
    expect(screen.getByRole('button', { name: /capture/i })).toBeInTheDocument();
  });
});
```

**Backend (pytest)**:

```python
import pytest
from document_processor import extract_text_from_image

def test_extract_text_success():
    """Test successful text extraction from image"""
    result = extract_text_from_image('test-image.jpg')
    assert result.confidence > 0.8
    assert len(result.text) > 0
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run frontend tests
cd frontend && pnpm test

# Run backend tests (Python)
cd backend/document-processing && pytest

# Run with coverage
pnpm test --coverage
```

## Documentation

### Code Documentation

- Add **JSDoc/docstrings** for all public functions
- Include **parameter descriptions** and **return types**
- Document **complex algorithms** with inline comments
- Add **examples** for non-obvious usage

### API Documentation

- Update **OpenAPI/Swagger** specs for API changes
- Document **request/response formats**
- Include **example requests** and **responses**
- Document **error codes** and **messages**

### User Documentation

- Update **README.md** for user-facing changes
- Add **screenshots** for UI changes
- Create **video tutorials** for complex features
- Update **troubleshooting guides** as needed

## Pull Request Process

### Before Creating a PR

1. **Ensure all tests pass**:

   ```bash
   pnpm test
   ```

2. **Lint your code**:

   ```bash
   pnpm lint
   ```

3. **Format your code**:

   ```bash
   pnpm format
   ```

4. **Update documentation** if needed

5. **Rebase on latest develop**:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

### Creating a PR

1. **Push to your fork**:

   ```bash
   git push origin feature/123-your-feature
   ```

2. **Create PR on GitHub** with:
   - Clear, descriptive title following commit convention
   - Complete PR template
   - Link to related issues
   - Screenshots for UI changes

3. **Request reviews** from:
   - CODEOWNERS (auto-assigned)
   - Relevant team members
   - Tech lead for significant changes

### PR Review Process

- **Address review comments** promptly
- **Push updates** to the same branch
- **Respond to reviewers** with explanations or questions
- **Request re-review** after making changes

### Merge Requirements

**For `develop` branch**:

- ✅ 1 approval required
- ✅ All CI checks passing
- ✅ No merge conflicts
- ✅ Conventional commit format

**For `main` branch**:

- ✅ 2 approvals required (including tech lead)
- ✅ All CI checks passing (including security scan)
- ✅ No merge conflicts
- ✅ Production readiness verified

## Healthcare Compliance

VaidyaLink handles Protected Health Information (PHI) and must comply with healthcare regulations.

### PHI Handling Rules

- **Never log PHI** in application logs
- **Encrypt all PHI** at rest and in transit
- **Implement audit logging** for all PHI access
- **Follow HIPAA guidelines** for data handling
- **Comply with ABDM standards** for Indian healthcare data

### Security Checklist

Before submitting code that handles patient data:

- [ ] No PHI in logs or error messages
- [ ] Encryption applied where required
- [ ] Audit logging implemented
- [ ] Input validation for all user inputs
- [ ] SQL injection prevention (if applicable)
- [ ] XSS prevention (if applicable)
- [ ] Authentication/authorization properly implemented
- [ ] No hardcoded secrets or credentials

### Compliance Review

Code involving PHI or security requires additional review:

- **Security team** review for authentication/encryption changes
- **Compliance officer** review for ABDM integration
- **Healthcare standards team** review for FHIR transformation

## Getting Help

### Resources

- **Documentation**: [docs/](docs/)
- **Git Workflow**: [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)
- **Code Quality**: [CODE_QUALITY.md](CODE_QUALITY.md)
- **Architecture**: [design.md](design.md)

### Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Slack**: #vaidyalink-dev (for team members)
- **Email**: contact@vaidyalink.in

### Asking Questions

When asking for help:

1. **Search existing issues** first
2. **Provide context**: What are you trying to do?
3. **Include details**: Error messages, code snippets, screenshots
4. **Describe what you've tried**: Show your debugging efforts
5. **Be patient**: Maintainers are volunteers

## Recognition

Contributors will be recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributors** page

## License

By contributing to VaidyaLink, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to VaidyaLink and helping improve healthcare accessibility in India! 🙏
