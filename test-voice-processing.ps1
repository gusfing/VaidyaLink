#!/usr/bin/env pwsh
# Test Voice Processing Integration

Write-Host "=== Voice Processing Integration Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if voice components exist
Write-Host "Checking voice processing components..." -ForegroundColor Yellow

$components = @(
    "frontend/components/document-scan-demo/VoiceRecorder.tsx",
    "frontend/components/document-scan-demo/VoiceResults.tsx",
    "frontend/app/document-scan-demo/page.tsx"
)

$allExist = $true
foreach ($component in $components) {
    if (Test-Path $component) {
        Write-Host "[OK] $component" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $component missing" -ForegroundColor Red
        $allExist = $false
    }
}

Write-Host ""

# Check backend
Write-Host "Checking voice processing backend..." -ForegroundColor Yellow
if (Test-Path "backend/voice-processing/src/index.js") {
    Write-Host "[OK] Voice processing Lambda found" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Voice processing Lambda missing" -ForegroundColor Red
    $allExist = $false
}

Write-Host ""

# Check build
Write-Host "Checking frontend build..." -ForegroundColor Yellow
if (Test-Path "frontend/.next") {
    Write-Host "[OK] Frontend built successfully" -ForegroundColor Green
} else {
    Write-Host "[WARN] Frontend not built yet" -ForegroundColor Yellow
    Write-Host "  Run: cd frontend; npm run build" -ForegroundColor Gray
}

Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan

if ($allExist) {
    Write-Host "[OK] All components ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To test voice processing:" -ForegroundColor White
    Write-Host "  cd frontend" -ForegroundColor Gray
    Write-Host "  npm run dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then open: http://localhost:3000/document-scan-demo" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Steps to test:" -ForegroundColor White
    Write-Host "  1. Click 'Voice Recording' tab" -ForegroundColor Gray
    Write-Host "  2. Select a language (e.g., Hindi)" -ForegroundColor Gray
    Write-Host "  3. Click 'Start Recording'" -ForegroundColor Gray
    Write-Host "  4. Speak for a few seconds" -ForegroundColor Gray
    Write-Host "  5. Click 'Stop Recording'" -ForegroundColor Gray
    Write-Host "  6. Click 'Process Recording'" -ForegroundColor Gray
    Write-Host "  7. View transcription and medical entities!" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Supported Languages:" -ForegroundColor White
    Write-Host "  English, Hindi, Bengali, Telugu, Marathi, Tamil," -ForegroundColor Gray
    Write-Host "  Gujarati, Kannada, Malayalam, Punjabi, Odia," -ForegroundColor Gray
    Write-Host "  Assamese, Urdu (and 9 more!)" -ForegroundColor Gray
} else {
    Write-Host "[FAIL] Some components are missing" -ForegroundColor Red
    Write-Host "Please check the errors above" -ForegroundColor Red
}

Write-Host ""
