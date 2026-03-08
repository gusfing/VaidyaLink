#!/usr/bin/env pwsh
# Deploy All VaidyaLink Features

param(
    [switch]$VoiceOnly,
    [switch]$SummarizerOnly,
    [switch]$FhirOnly,
    [switch]$AbdmOnly,
    [switch]$All
)

Write-Host "=== VaidyaLink Feature Deployment ===" -ForegroundColor Cyan
Write-Host ""

$features = @()

if ($VoiceOnly) {
    $features = @("voice")
} elseif ($SummarizerOnly) {
    $features = @("summarizer")
} elseif ($FhirOnly) {
    $features = @("fhir")
} elseif ($AbdmOnly) {
    $features = @("abdm")
} elseif ($All) {
    $features = @("voice", "summarizer", "fhir", "abdm")
} else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  ./deploy-all-features.ps1 -VoiceOnly       # Deploy voice processing only"
    Write-Host "  ./deploy-all-features.ps1 -SummarizerOnly  # Deploy clinical summarizer only"
    Write-Host "  ./deploy-all-features.ps1 -FhirOnly        # Deploy FHIR transformer only"
    Write-Host "  ./deploy-all-features.ps1 -AbdmOnly        # Deploy ABDM connector only"
    Write-Host "  ./deploy-all-features.ps1 -All             # Deploy all features"
    Write-Host ""
    exit 0
}

# Deploy Voice Processing
if ($features -contains "voice") {
    Write-Host "[1/4] Deploying Voice Processing..." -ForegroundColor Yellow
    Write-Host "Location: backend/voice-processing" -ForegroundColor Gray

    if (Test-Path "backend/voice-processing") {
        Push-Location backend/voice-processing

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        npm install --silent

        Write-Host "  - Building Lambda package..." -ForegroundColor Gray
        npm run build

        Write-Host "  - Deploying to AWS..." -ForegroundColor Gray
        aws lambda update-function-code `
            --function-name vaidyalink-voice-processing-dev `
            --zip-file fileb://dist/lambda.zip `
            --region ap-south-1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Voice Processing deployed" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Voice Processing deployment failed" -ForegroundColor Red
        }

        Pop-Location
    } else {
        Write-Host "  [SKIP] Voice Processing not found" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Deploy Clinical Summarizer
if ($features -contains "summarizer") {
    Write-Host "[2/4] Deploying Clinical Summarizer..." -ForegroundColor Yellow
    Write-Host "Location: backend/clinical-summarizer" -ForegroundColor Gray

    if (Test-Path "backend/clinical-summarizer") {
        Push-Location backend/clinical-summarizer

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        pip install -r requirements.txt --quiet

        Write-Host "  - Packaging Lambda..." -ForegroundColor Gray
        if (Test-Path "lambda.zip") { Remove-Item "lambda.zip" }
        Compress-Archive -Path src/,requirements.txt -DestinationPath lambda.zip

        Write-Host "  - Deploying to AWS..." -ForegroundColor Gray
        aws lambda update-function-code `
            --function-name vaidyalink-clinical-summarizer-dev `
            --zip-file fileb://lambda.zip `
            --region ap-south-1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Clinical Summarizer deployed" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Clinical Summarizer deployment failed" -ForegroundColor Red
        }

        Pop-Location
    } else {
        Write-Host "  [SKIP] Clinical Summarizer not found" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Deploy FHIR Transformer
if ($features -contains "fhir") {
    Write-Host "[3/4] Deploying FHIR Transformer..." -ForegroundColor Yellow
    Write-Host "Location: backend/fhir-transformer" -ForegroundColor Gray

    if (Test-Path "backend/fhir-transformer") {
        Push-Location backend/fhir-transformer

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        pip install -r requirements.txt --quiet

        Write-Host "  - Packaging Lambda..." -ForegroundColor Gray
        if (Test-Path "lambda.zip") { Remove-Item "lambda.zip" }
        Compress-Archive -Path src/,requirements.txt -DestinationPath lambda.zip

        Write-Host "  - Deploying to AWS..." -ForegroundColor Gray
        aws lambda update-function-code `
            --function-name vaidyalink-fhir-transformer-dev `
            --zip-file fileb://lambda.zip `
            --region ap-south-1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] FHIR Transformer deployed" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] FHIR Transformer deployment failed" -ForegroundColor Red
        }

        Pop-Location
    } else {
        Write-Host "  [SKIP] FHIR Transformer not found" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Deploy ABDM Connector
if ($features -contains "abdm") {
    Write-Host "[4/4] Deploying ABDM Connector..." -ForegroundColor Yellow
    Write-Host "Location: backend/abdm-connector" -ForegroundColor Gray

    if (Test-Path "backend/abdm-connector") {
        Push-Location backend/abdm-connector

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        npm install --silent

        Write-Host "  - Building Lambda package..." -ForegroundColor Gray
        npm run build

        Write-Host "  - Deploying to AWS..." -ForegroundColor Gray
        aws lambda update-function-code `
            --function-name vaidyalink-abdm-connector-dev `
            --zip-file fileb://dist/lambda.zip `
            --region ap-south-1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] ABDM Connector deployed" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] ABDM Connector deployment failed" -ForegroundColor Red
        }

        Pop-Location
    } else {
        Write-Host "  [SKIP] ABDM Connector not found" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Test each Lambda function" -ForegroundColor Gray
Write-Host "  2. Check CloudWatch logs" -ForegroundColor Gray
Write-Host "  3. Update frontend integration" -ForegroundColor Gray
Write-Host "  4. Run end-to-end tests" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation:" -ForegroundColor White
Write-Host "  - All Features Guide: docs/ALL_FEATURES_INTEGRATION_GUIDE.md" -ForegroundColor Gray
Write-Host "  - Feature Showcase: docs/COMPLETE_FEATURE_SHOWCASE.md" -ForegroundColor Gray
Write-Host ""
