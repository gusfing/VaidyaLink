#!/usr/bin/env pwsh
# Quick test script for Document Scan Demo

Write-Host "=== VaidyaLink Document Scan Demo - Test Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if sample files exist
Write-Host "Checking sample prescription files..." -ForegroundColor Yellow
$sample1 = Test-Path "frontend/public/sample-prescription.jpg"
$sample2 = Test-Path "frontend/public/new-prescription.jpg"

if ($sample1) {
    Write-Host "[OK] Sample 1 (Vivek M) found" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Sample 1 missing" -ForegroundColor Red
}

if ($sample2) {
    Write-Host "[OK] Sample 2 (New) found" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Sample 2 missing" -ForegroundColor Red
}

Write-Host ""

# Check environment configuration
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path "frontend/.env.local") {
    $envContent = Get-Content "frontend/.env.local" -Raw
    if ($envContent -match "NEXT_PUBLIC_DEMO_MODE=true") {
        Write-Host "[OK] Demo mode enabled" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Demo mode disabled (will use real AWS)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[FAIL] .env.local not found" -ForegroundColor Red
}

Write-Host ""

# Check if node_modules exists
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "frontend/node_modules") {
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Dependencies not installed. Run: cd frontend; npm install" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan

if ($sample1 -and $sample2) {
    Write-Host "[OK] All sample files ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start testing:" -ForegroundColor White
    Write-Host "  cd frontend" -ForegroundColor Gray
    Write-Host "  npm run dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then open: http://localhost:3000/document-scan-demo" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Click either sample button to test:" -ForegroundColor White
    Write-Host "  - Sample 1 (Vivek M) - Blue button" -ForegroundColor Blue
    Write-Host "  - Sample 2 (New) - Green button" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Some files are missing" -ForegroundColor Red
}

Write-Host ""
