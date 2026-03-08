# VaidyaLink Code Quality Verification Script (PowerShell)
# This script verifies that ESLint, Prettier, and Husky are properly configured

Write-Host "VaidyaLink Code Quality Setup Verification" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
Write-Host "Checking pnpm installation..." -ForegroundColor Green
$pnpmCheck = Get-Command pnpm -ErrorAction SilentlyContinue
if ($null -eq $pnpmCheck) {
    Write-Host "pnpm is not installed. Please install it first." -ForegroundColor Red
    exit 1
}
$pnpmVersion = pnpm --version
Write-Host "  pnpm version: $pnpmVersion" -ForegroundColor Gray
Write-Host ""

# Check if node_modules exists
Write-Host "Checking dependencies..." -ForegroundColor Green
if (-Not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Run 'pnpm install' first." -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed" -ForegroundColor Gray
Write-Host ""

# Check configuration files
Write-Host "Checking configuration files..." -ForegroundColor Green
$files = @(
    ".prettierrc",
    ".prettierignore",
    "eslint.config.mjs",
    ".lintstagedrc.json",
    ".husky/pre-commit",
    "pyproject.toml",
    ".flake8"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  Found: $file" -ForegroundColor Gray
    }
    else {
        Write-Host "  Missing: $file" -ForegroundColor Red
    }
}
Write-Host ""

# Test Prettier
Write-Host "Testing Prettier..." -ForegroundColor Green
$null = pnpm format:check 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  All files are properly formatted" -ForegroundColor Gray
}
else {
    Write-Host "  Some files need formatting (run 'pnpm format')" -ForegroundColor Yellow
}
Write-Host ""

# Check Husky
Write-Host "Checking Husky setup..." -ForegroundColor Green
if (Test-Path ".husky/_") {
    Write-Host "  Husky is properly initialized" -ForegroundColor Gray
}
else {
    Write-Host "  Husky not initialized (run 'pnpm prepare')" -ForegroundColor Red
}
Write-Host ""

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Code quality setup verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  pnpm lint          - Lint all workspaces"
Write-Host "  pnpm lint:fix      - Lint and fix all workspaces"
Write-Host "  pnpm format        - Format all files"
Write-Host "  pnpm format:check  - Check formatting"
Write-Host ""
