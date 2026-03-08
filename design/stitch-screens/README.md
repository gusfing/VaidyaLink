# Stitch Screens Directory

This directory contains design assets and specifications from the Stitch project.

## Project Details

- **Project ID**: 14580138233997456824
- **Project Title**: Voice Dashboard
- **Platform**: Stitch (stitch.new)

## Screens

### 1. Health Passport Profile

- **ID**: `1267d9e988bc484f937de6888b5146571`
- **File**: `1-health-passport-profile.png`
- **Implementation**: `/vaidyalink/health-passport`

### 2. Records Library

- **ID**: `68ba68bedf1b4e02b58ba717e09e9b1d`
- **File**: `2-records-library.png`
- **Implementation**: `/vaidyalink/records`

### 3. Doctor's Insight View

- **ID**: `968f73dcad0841a2906b71f8c30c078c`
- **File**: `3-doctors-insight-view.png`
- **Implementation**: `/vaidyalink/doctor-portal`

### 4. Voice Dashboard

- **ID**: `b67a7d9ff01242359c1f1602f16c6f64`
- **File**: `4-voice-dashboard.png`
- **Implementation**: `/vaidyalink/voice`

### 5. AI Document Scanner

- **ID**: `d4283b7b7a8a4742aa98289aa2870495`
- **File**: `5-ai-document-scanner.png`
- **Implementation**: `/vaidyalink/scanner`

### 6. Health Timeline & Export

- **ID**: `eef50c3373d24edeb3d6f2c63d02e3b3`
- **File**: `6-health-timeline-export.png`
- **Implementation**: `/vaidyalink/timeline`

## Manual Download Instructions

### Method 1: Direct from Stitch

1. Visit: https://stitch.new/project/14580138233997456824
2. Navigate to each screen
3. Use export/download options
4. Save files to this directory

### Method 2: Screenshot from Production

Since all screens are live, you can capture them from production:

```bash
# Visit production URLs and take screenshots at 430px width

# 1. Health Passport
https://vaidya-link.vercel.app/vaidyalink/health-passport

# 2. Records Library
https://vaidya-link.vercel.app/vaidyalink/records

# 3. Doctor's Insight
https://vaidya-link.vercel.app/vaidyalink/doctor-portal

# 4. Voice Dashboard
https://vaidya-link.vercel.app/vaidyalink/voice

# 5. AI Scanner
https://vaidya-link.vercel.app/vaidyalink/scanner

# 6. Health Timeline
https://vaidya-link.vercel.app/vaidyalink/timeline
```

### Method 3: Using Browser DevTools

1. Open Chrome/Edge DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Set dimensions to 430 x 932 (iPhone 14 Pro Max)
4. Navigate to each URL
5. Right-click → "Capture screenshot" or use extension

## File Naming Convention

```
[number]-[screen-name].png
[number]-[screen-name]-code.tsx (if available)
[number]-[screen-name]-styles.css (if available)
```

## Expected Files

- `1-health-passport-profile.png`
- `2-records-library.png`
- `3-doctors-insight-view.png`
- `4-voice-dashboard.png`
- `5-ai-document-scanner.png`
- `6-health-timeline-export.png`

## Code Export

If Stitch provides code export, save as:

- `1-health-passport-profile-code.tsx`
- `2-records-library-code.tsx`
- etc.

## Notes

- All screens are already implemented and live
- This directory serves as design reference
- Compare Stitch designs with production implementation
- Use for design reviews and documentation

## Related Files

- Design system: `../STITCH_PROJECT_REFERENCE.md`
- Implementation: `../../frontend/app/vaidyalink/`
- Styles: `../../frontend/app/vaidyalink/vaidyalink.css`
