# Run property-based tests for document processor (PowerShell)

Write-Host "Running property-based tests for entity extraction..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if pytest is installed
try {
    python -c "import pytest" 2>&1 | Out-Null
    Write-Host "pytest is installed" -ForegroundColor Green
} catch {
    Write-Host "Installing test dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Run the property tests
Write-Host ""
Write-Host "Running Property 5: Entity Confidence Scores" -ForegroundColor Yellow
Write-Host "Running Property 6: Medication Structure Completeness" -ForegroundColor Yellow
Write-Host "Running Property 7: Lab Result Structure Completeness" -ForegroundColor Yellow
Write-Host ""

python -m pytest src/__properties__/entity_extraction.properties.test.py `
    -v `
    --tb=short `
    --hypothesis-max-examples=100

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Property tests completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Property tests failed!" -ForegroundColor Red
    exit 1
}
