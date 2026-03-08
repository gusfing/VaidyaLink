# VaidyaLink Screenshot Capture Script
# This script helps capture screenshots of all VaidyaLink screens

Write-Host "VaidyaLink Screenshot Capture Helper" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$screens = @(
    @{
        Name = "Health Passport Profile"
        URL = "https://vaidya-link.vercel.app/vaidyalink/health-passport"
        File = "1-health-passport-profile.png"
    },
    @{
        Name = "Records Library"
        URL = "https://vaidya-link.vercel.app/vaidyalink/records"
        File = "2-records-library.png"
    },
    @{
        Name = "Doctor's Insight View"
        URL = "https://vaidya-link.vercel.app/vaidyalink/doctor-portal"
        File = "3-doctors-insight-view.png"
    },
    @{
        Name = "Voice Dashboard"
        URL = "https://vaidya-link.vercel.app/vaidyalink/voice"
        File = "4-voice-dashboard.png"
    },
    @{
        Name = "AI Document Scanner"
        URL = "https://vaidya-link.vercel.app/vaidyalink/scanner"
        File = "5-ai-document-scanner.png"
    },
    @{
        Name = "Health Timeline & Export"
        URL = "https://vaidya-link.vercel.app/vaidyalink/timeline"
        File = "6-health-timeline-export.png"
    }
)

Write-Host "Manual Screenshot Instructions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open Chrome or Edge browser" -ForegroundColor White
Write-Host "2. Press F12 to open DevTools" -ForegroundColor White
Write-Host "3. Press Ctrl+Shift+M to toggle device toolbar" -ForegroundColor White
Write-Host "4. Set dimensions to: 430 x 932 (iPhone 14 Pro Max)" -ForegroundColor White
Write-Host "5. For each URL below:" -ForegroundColor White
Write-Host "   - Navigate to the URL" -ForegroundColor White
Write-Host "   - Wait for page to load completely" -ForegroundColor White
Write-Host "   - Right-click and select 'Capture screenshot'" -ForegroundColor White
Write-Host "   - Save with the suggested filename" -ForegroundColor White
Write-Host ""

foreach ($screen in $screens) {
    Write-Host "Screen: $($screen.Name)" -ForegroundColor Green
    Write-Host "URL:    $($screen.URL)" -ForegroundColor Cyan
    Write-Host "Save as: stitch-screens/$($screen.File)" -ForegroundColor Yellow
    Write-Host ""

    # Open URL in default browser
    $response = Read-Host "Open this URL in browser? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process $screen.URL
        Write-Host "Opened in browser. Take screenshot and press Enter when done..." -ForegroundColor Magenta
        Read-Host
    }
}

Write-Host ""
Write-Host "Screenshot capture complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Alternative: Use Stitch Platform" -ForegroundColor Yellow
Write-Host "Visit: https://stitch.new/project/14580138233997456824" -ForegroundColor Cyan
Write-Host "Export screens directly from Stitch if available" -ForegroundColor White
Write-Host ""

# Check if screenshots were saved
$savedCount = 0
foreach ($screen in $screens) {
    $filePath = Join-Path "stitch-screens" $screen.File
    if (Test-Path $filePath) {
        $savedCount++
        Write-Host "✓ Found: $($screen.File)" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing: $($screen.File)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Screenshots saved: $savedCount / $($screens.Count)" -ForegroundColor $(if ($savedCount -eq $screens.Count) { "Green" } else { "Yellow" })
