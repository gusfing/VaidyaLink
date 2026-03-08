# pnpm Workspace Guide for VaidyaLink

This document explains the pnpm workspace configuration for the VaidyaLink monorepo and provides common commands for working with the workspace.

## Workspace Structure

The VaidyaLink monorepo is organized into the following workspaces:

```
vaidyalink/
├── frontend/                    # @vaidyalink/frontend - Next.js web application
├── backend/
│   ├── abdm-connector/         # @vaidyalink/abdm-connector - ABDM integration (Node.js)
│   ├── voice-processing/       # @vaidyalink/voice-processing - Voice transcription (Node.js)
│   ├── hitl-handler/           # @vaidyalink/hitl-handler - HITL workflow (Node.js)
│   ├── shared/                 # @vaidyalink/shared - Shared utilities (Node.js)
│   ├── document-processing/    # Python Lambda (managed via requirements.txt)
│   ├── clinical-summarizer/    # Python Lambda (managed via requirements.txt)
│   └── fhir-transformer/       # Python Lambda (managed via requirements.txt)
└── infrastructure/             # @vaidyalink/infrastructure - AWS CDK
```

### Package Types

**Node.js Packages (managed by pnpm):**

- `@vaidyalink/frontend` - Next.js application
- `@vaidyalink/abdm-connector` - ABDM integration Lambda
- `@vaidyalink/voice-processing` - Voice processing Lambda
- `@vaidyalink/hitl-handler` - HITL handler Lambda
- `@vaidyalink/shared` - Shared utilities
- `@vaidyalink/infrastructure` - AWS CDK infrastructure

**Python Packages (managed separately):**

- `document-processing` - Uses `requirements.txt`
- `clinical-summarizer` - Uses `requirements.txt`
- `fhir-transformer` - Uses `requirements.txt`

## Common Commands

### Installing Depen

m -r run build

# Run a script in a specific workspace

pnpm --filter @vaidyalink/frontend dev

# Run a script in multiple workspaces using glob patterns

pnpm --filter "@vaidyalink/backend-\*" test

# Run scripts in parallel (default behavior)

pnpm -r run test

# Run scripts sequentially

pnpm -r --workspace-concurrency=1 run build

````

### Listing Packages

```bash
# List all workspace packages
pnpm -r list --depth 0

# List dependencies for a specific workspace
pnpm --filter @vaidyalink/frontend list --depth 0

# List all workspaces
pnpm -r exec pwd  # Unix/Linux
pnpm -r exec echo %cd%  # Windows
````

### Workspace Filtering

```bash
# Filter by package name
pnpm --filter @vaidyalink/frontend dev

# Filter by directory
pnpm --filter "./frontend" dev

# Filter multiple packages
pnpm --filter @vaidyalink/frontend --filter @vaidyalink/infrastructure build

# Filter by pattern
pnpm --filter "@vaidyalink/*" test

# Exclude packages
pnpm --filter "!@vaidyalink/frontend" test
```

### Development Workflow

```bash
# Start frontend development server
pnpm dev
# or
pnpm --filter @vaidyalink/frontend dev

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Lint all packages
pnpm lint

# Format all code
pnpm format

# Deploy to development environment
pnpm deploy:dev
```

### Working with Dependencies

```bash
# Update all dependencies
pnpm -r update

# Update a specific dependency across all workspaces
pnpm -r update axios

# Check for outdated dependencies
pnpm -r outdated

# Remove a dependency from a workspace
pnpm --filter @vaidyalink/frontend remove axios
```

## Workspace Configuration

The workspace is configured in `pnpm-workspace.yaml`:

```yaml
packages:
  - 'frontend'
  - 'backend/abdm-connector'
  - 'backend/voice-processing'
  - 'backend/hitl-handler'
  - 'backend/shared'
  - 'infrastructure'
```

### Why Not Use `backend/*`?

We explicitly list Node.js backend services instead of using `backend/*` because:

1. **Mixed Language Support**: The backend directory contains both Node.js and Python services
2. **Clarity**: Explicit listing makes it clear which services are part of the pnpm workspace
3. **Avoid Errors**: Python services without `package.json` would cause pnpm warnings

## Root Package Scripts

The root `package.json` provides convenient scripts for common operations:

```json
{
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "lint:fix": "pnpm -r lint:fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:python": "black backend/",
    "lint:python": "flake8 backend/",
    "deploy:dev": "pnpm --filter infrastructure deploy:dev",
    "deploy:staging": "pnpm --filter infrastructure deploy:staging",
    "deploy:prod": "pnpm --filter infrastructure deploy:prod"
  }
}
```

## Best Practices

### 1. Use Workspace Protocol for Internal Dependencies

When one workspace depends on another, use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@vaidyalink/shared": "workspace:*"
  }
}
```

### 2. Consistent Naming Convention

All workspace packages use the `@vaidyalink/` scope:

- Makes it clear which packages are internal
- Prevents naming conflicts with external packages
- Enables easy filtering with `--filter "@vaidyalink/*"`

### 3. Shared Dev Dependencies

Common dev dependencies (ESLint, Prettier, TypeScript) are installed at the root level to:

- Reduce duplication
- Ensure consistent tooling versions
- Minimize installation time

### 4. Parallel Execution

pnpm runs scripts in parallel by default, which speeds up operations like:

- `pnpm -r build` - Builds all packages simultaneously
- `pnpm -r test` - Runs all tests in parallel

For sequential execution when needed:

```bash
pnpm -r --workspace-concurrency=1 run build
```

### 5. Filtering for Efficiency

Use filters to work on specific parts of the monorepo:

```bash
# Work on frontend only
pnpm --filter @vaidyalink/frontend dev

# Work on all backend services
pnpm --filter "./backend/**" test

# Work on everything except infrastructure
pnpm --filter "!@vaidyalink/infrastructure" build
```

## Troubleshooting

### Issue: "No projects matched the filters"

**Solution**: Check that the package name in `--filter` matches the `name` field in the workspace's `package.json`.

### Issue: "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL"

**Solution**: One of the workspaces failed to run the script. Check the error output to identify which workspace failed and why.

### Issue: Dependency not found

**Solution**: Make sure you've run `pnpm install` at the root level to install all workspace dependencies.

### Issue: Changes not reflected

**Solution**: If you've modified `pnpm-workspace.yaml`, run `pnpm install` again to update the workspace configuration.

## Python Services

Python Lambda services are managed separately:

```bash
# Install Python dependencies for a specific service
cd backend/document-processing
pip install -r requirements.txt

# Or use the root-level scripts
pnpm format:python  # Format Python code with Black
pnpm lint:python    # Lint Python code with Flake8
```

## Additional Resources

- [pnpm Workspace Documentation](https://pnpm.io/workspaces)
- [pnpm CLI Documentation](https://pnpm.io/cli/install)
- [pnpm Filtering Documentation](https://pnpm.io/filtering)

## Summary

The pnpm workspace configuration provides:

✅ **Efficient dependency management** - Shared dependencies are deduplicated
✅ **Fast installations** - pnpm's content-addressable storage saves disk space
✅ **Parallel execution** - Run scripts across multiple packages simultaneously
✅ **Flexible filtering** - Work on specific parts of the monorepo
✅ **Type safety** - TypeScript works seamlessly across workspace boundaries
✅ **Mixed language support** - Node.js packages in pnpm, Python packages separate

This setup enables efficient development across the entire VaidyaLink platform while maintaining clear separation between different services and technologies.
