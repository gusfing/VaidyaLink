# Code Quality Configuration

This document describes the code quality tools and configurations used in the VaidyaLink monorepo.

## Overview

The project uses the following tools to maintain code quality:

- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **Black**: Python code formatting
- **Flake8**: Python linting
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Configuration Files

### Root Level

- `.prettierrc` - Prettier configuration for the entire monorepo
- `.prettierignore` - Files to ignore for Prettier
- `eslint.config.mjs` - Base ESLint configuration
- `.flake8` - Flake8 configuration for Python
- `pyproject.toml` - Black and other Python tool configurations
- `.lintstagedrc.json` - lint-staged configuration
- `.husky/pre-commit` - Pre-commit hook

### Workspace-Specific

- `frontend/eslint.config.mjs` - Next.js specific ESLint config
- `frontend/.prettierrc` - Frontend Prettier config (extends root)
- `infrastructure/eslint.config.mjs` - TypeScript ESLint config for CDK
- `backend/*/eslint.config.mjs` - Node.js Lambda ESLint configs

## Usage

### Linting

```bash
# Lint all workspaces
pnpm lint

# Lint and fix all workspaces
pnpm lint:fix

# Lint specific workspace
pnpm --filter frontend lint
pnpm --filter infrastructure lint
pnpm --filter @vaidyalink/abdm-connector lint

# Lint Python code
pnpm lint:python
```

### Formatting

```bash
# Format all JavaScript/TypeScript files
pnpm format

# Check formatting without making changes
pnpm format:check

# Format Python code
pnpm format:python

# Format specific workspace
pnpm --filter frontend format
```

### Pre-commit Hooks

Husky is configured to run lint-staged before each commit. This ensures that:

1. All staged JavaScript/TypeScript files are linted and formatted
2. All staged Python files are formatted with Black and linted with Flake8
3. All staged JSON/Markdown files are formatted

To bypass the pre-commit hook (not recommended):

```bash
git commit --no-verify
```

## ESLint Rules

### JavaScript/TypeScript (Node.js Lambdas)

- `no-console`: off (allowed for CloudWatch logs)
- `no-unused-vars`: error (with `_` prefix exception)
- `prefer-const`: error
- `no-var`: error

### TypeScript (Infrastructure)

- `@typescript-eslint/no-unused-vars`: error (with `_` prefix exception)
- `@typescript-eslint/explicit-function-return-type`: off
- `@typescript-eslint/no-explicit-any`: warn

### Next.js (Frontend)

Uses Next.js recommended ESLint configuration with TypeScript support.

## Prettier Configuration

- **Semi**: true (use semicolons)
- **Single Quote**: true (use single quotes)
- **Print Width**: 100 characters
- **Tab Width**: 2 spaces
- **Trailing Comma**: ES5 compatible
- **End of Line**: LF (Unix-style)

## Python Configuration

### Black

- **Line Length**: 100 characters
- **Target Version**: Python 3.11

### Flake8

- **Max Line Length**: 100 characters
- **Ignored Rules**:
  - E203: whitespace before ':'
  - W503: line break before binary operator
  - E501: line too long (handled by Black)

## IDE Integration

### VS Code

Install the following extensions:

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Python (`ms-python.python`)
- Black Formatter (`ms-python.black-formatter`)

Add to your `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "python.linting.flake8Enabled": true,
  "python.linting.enabled": true
}
```

## CI/CD Integration

The linting and formatting checks should be integrated into the CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: pnpm install

- name: Check formatting
  run: pnpm format:check

- name: Lint JavaScript/TypeScript
  run: pnpm lint

- name: Lint Python
  run: pnpm lint:python
```

## Troubleshooting

### Husky hooks not running

If Husky hooks are not running, ensure they are executable:

```bash
chmod +x .husky/pre-commit
```

### ESLint errors in IDE

If you see ESLint errors in your IDE, try:

1. Restart the ESLint server (VS Code: Cmd/Ctrl + Shift + P → "ESLint: Restart ESLint Server")
2. Ensure you have the latest ESLint extension installed
3. Check that `eslint.config.mjs` exists in the workspace

### Python linting not working

Ensure you have the Python tools installed:

```bash
pip install black flake8 isort
```

Or use the project's virtual environment if configured.

## Maintenance

### Updating Dependencies

To update linting and formatting tools:

```bash
# Update root dependencies
pnpm update eslint prettier husky lint-staged -w

# Update workspace dependencies
pnpm update -r eslint prettier
```

### Adding New Rules

1. Update the appropriate `eslint.config.mjs` file
2. Run `pnpm lint:fix` to apply the new rules
3. Commit the changes

## Best Practices

1. **Always run linting before committing**: The pre-commit hook will catch most issues
2. **Fix linting errors, don't disable them**: Only disable rules when absolutely necessary
3. **Keep configurations consistent**: Use the root configurations as the base
4. **Document exceptions**: If you need to disable a rule, add a comment explaining why
5. **Review linting errors in PRs**: Don't merge code with linting errors

## Resources

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [Black Documentation](https://black.readthedocs.io/)
- [Flake8 Documentation](https://flake8.pycqa.org/)
- [Husky Documentation](https://typicode.github.io/husky/)
