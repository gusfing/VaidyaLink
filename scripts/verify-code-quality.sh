#!/bin/bash

# VaidyaLink Code Quality Verification Script
# This script verifies that ESLint, Prettier, and Husky are properly configured

echo "🔍 VaidyaLink Code Quality Setup Verification"
echo "=============================================="
echo ""

# Check if pnpm is installed
echo "✓ Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first."
    exit 1
fi
echo "  pnpm version: $(pnpm --version)"
echo ""

# Check if node_modules exists
echo "✓ Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Run 'pnpm install' first."
    exit 1
fi
echo "  Dependencies installed"
echo ""

# Check configuration files
echo "✓ Checking configuration files..."
files=(
    ".prettierrc"
    ".prettierignore"
    "eslint.config.mjs"
    ".lintstagedrc.json"
    ".husky/pre-commit"
    "pyproject.toml"
    ".flake8"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ❌ $file not found"
    fi
done
echo ""

# Test Prettier
echo "✓ Testing Prettier..."
if pnpm format:check > /dev/null 2>&1; then
    echo "  ✓ All files are properly formatted"
else
    echo "  ⚠️  Some files need formatting (run 'pnpm format')"
fi
echo ""

# Test ESLint (frontend)
echo "✓ Testing ESLint (frontend)..."
if pnpm --filter frontend lint > /dev/null 2>&1; then
    echo "  ✓ Frontend linting passed"
else
    echo "  ⚠️  Frontend has linting issues"
fi
echo ""

# Test ESLint (infrastructure)
echo "✓ Testing ESLint (infrastructure)..."
if pnpm --filter infrastructure lint > /dev/null 2>&1; then
    echo "  ✓ Infrastructure linting passed"
else
    echo "  ⚠️  Infrastructure has linting issues"
fi
echo ""

# Check Husky
echo "✓ Checking Husky setup..."
if [ -d ".husky/_" ]; then
    echo "  ✓ Husky is properly initialized"
else
    echo "  ❌ Husky not initialized (run 'pnpm prepare')"
fi
echo ""

echo "=============================================="
echo "✅ Code quality setup verification complete!"
echo ""
echo "Available commands:"
echo "  pnpm lint          - Lint all workspaces"
echo "  pnpm lint:fix      - Lint and fix all workspaces"
echo "  pnpm format        - Format all files"
echo "  pnpm format:check  - Check formatting"
echo ""
