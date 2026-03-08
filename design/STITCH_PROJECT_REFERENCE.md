# VaidyaLink Stitch Project Reference

## Project Information

- **Title**: Voice Dashboard
- **Project ID**: 14580138233997456824
- **Platform**: Stitch (stitch.new)

---

## Screens Overview

### 1. Health Passport Profile

- **Screen ID**: `1267d9e988bc484f937de6888b5146571`
- **Description**: Patient profile with ABHA integration, personal health information
- **Implemented**: ✅ `/vaidyalink/health-passport`
- **Status**: Live on production

**Key Features**:

- Patient photo and basic info
- ABHA ID verification badge
- Blood type and allergies
- Chronic conditions
- Emergency contacts
- Authorized doctors list

---

### 2. Records Library

- **Screen ID**: `68ba68bedf1b4e02b58ba717e09e9b1d`
- **Description**: Medical document management and organization
- **Implemented**: ✅ `/vaidyalink/records`
- **Status**: Live on production

**Key Features**:

- Document grid with thumbnails
- Category filters (prescriptions, lab reports, scans)
- Search functionality
- Upload new documents
- Verification badges
- Processing status indicators

---

### 3. Doctor's Insight View

- **Screen ID**: `968f73dcad0841a2906b71f8c30c078c`
- **Description**: AI-powered clinical summary for healthcare providers
- **Implemented**: ✅ `/vaidyalink/doctor-portal`
- **Status**: Live on production

**Key Features**:

- Patient snapshot card
- AI-generated clinical summary
- Chief complaint and recent context
- Critical flags highlighting
- Vital signs display
- Current medications list
- Recent lab results
- Time saved indicator
- Confidence score

---

### 4. Voice Dashboard

- **Screen ID**: `b67a7d9ff01242359c1f1602f16c6f64`
- **Description**: Voice-to-text medical note capture with multilingual support
- **Implemented**: ✅ `/vaidyalink/voice`
- **Status**: Live on production

**Key Features**:

- Voice recording interface
- Real-time waveform visualization
- Language selection (Hindi, English, Tamil, etc.)
- Transcription display
- Structured data extraction
- Chief complaint identification
- Symptoms list
- Duration and severity tracking
- Current medications capture
- Allergies detection

---

### 5. AI Document Scanner

- **Screen ID**: `d4283b7b7a8a4742aa98289aa2870495`
- **Description**: Camera-based document scanning with OCR and entity extraction
- **Implemented**: ✅ `/vaidyalink/scanner`
- **Status**: Live on production

**Key Features**:

- Camera viewfinder with scanning frame
- Corner guides for alignment
- Scan line animation
- Image preview
- Processing indicator
- OCR text extraction
- Entity recognition (medications, conditions, lab results)
- Confidence scores
- Structured data display

---

### 6. Health Timeline & Export

- **Screen ID**: `eef50c3373d24edeb3d6f2c63d02e3b3`
- **Description**: Chronological health history with FHIR export capability
- **Implemented**: ✅ `/vaidyalink/timeline`
- **Status**: Live on production

**Key Features**:

- Timeline visualization
- Event cards (visits, labs, prescriptions, scans)
- Date-based organization
- Event type icons
- Doctor information
- Structured data display
- FHIR export button
- Download capability
- Share functionality

---

## Design System

### Color Palette

```css
/* Light Mode */
--primary: #007f80;
--primary-hover: #006666;
--background: #ffffff;
--surface: #f5f5f5;
--text-primary: #1a1a1a;
--text-secondary: #666666;
--border: #e0e0e0;
--success: #4caf50;
--warning: #ff9800;
--error: #f44336;

/* Dark Mode */
--primary-dark: #00a8a9;
--primary-hover-dark: #008a8b;
--background-dark: #1a1a1a;
--surface-dark: #2a2a2a;
--text-primary-dark: #ffffff;
--text-secondary-dark: #b0b0b0;
--border-dark: #404040;
```

### Typography

```css
/* Font Family */
font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Font Sizes */
--font-xs: 0.75rem; /* 12px */
--font-sm: 0.875rem; /* 14px */
--font-base: 1rem; /* 16px */
--font-lg: 1.125rem; /* 18px */
--font-xl: 1.25rem; /* 20px */
--font-2xl: 1.5rem; /* 24px */
--font-3xl: 1.875rem; /* 30px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing

```css
--space-xs: 0.25rem; /* 4px */
--space-sm: 0.5rem; /* 8px */
--space-md: 1rem; /* 16px */
--space-lg: 1.5rem; /* 24px */
--space-xl: 2rem; /* 32px */
--space-2xl: 3rem; /* 48px */
```

### Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

---

## Component Library

### Cards

- **Health Passport Card**: Patient info display
- **Record Card**: Document thumbnail with metadata
- **Patient Snapshot**: Compact patient overview
- **Info Card**: General information container
- **Stat Card**: Metric display with icon

### Buttons

- **Primary Button**: Main actions (44px min height)
- **Secondary Button**: Alternative actions
- **Icon Button**: Icon-only actions
- **FAB**: Floating action button
- **Scan Button**: Large camera trigger

### Navigation

- **Bottom Navigation**: 5 main tabs with icons
- **Header**: Page title with back button
- **Theme Toggle**: Light/dark mode switch

### Forms

- **Text Input**: Standard text entry
- **File Input**: Document upload
- **Voice Input**: Audio recording
- **Language Select**: Dropdown for language selection

### Feedback

- **Loading Spinner**: Processing indicator
- **Progress Bar**: Upload/processing progress
- **Toast**: Success/error messages
- **Badge**: Status indicators

---

## Responsive Design

### Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) {
  /* Tablet */
}

@media (min-width: 1024px) {
  /* Desktop - 430px container */
  .mobile-container {
    max-width: 430px;
    margin: 0 auto;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
}
```

### Touch Targets

- Minimum size: 44px × 44px (WCAG 2.1 AA)
- Spacing between targets: 8px minimum
- Active state feedback: Scale transform or color change

---

## Accessibility

### WCAG 2.1 AA Compliance

- ✅ Color contrast ratio: 4.5:1 minimum
- ✅ Keyboard navigation: Full support
- ✅ Screen reader: Semantic HTML and ARIA labels
- ✅ Focus indicators: Visible outlines
- ✅ Touch targets: 44px minimum
- ✅ Error messages: Clear and descriptive

### Semantic HTML

```html
<header>
  <nav>
    <main>
      <section>
        <article>
          <aside>
            <footer></footer>
          </aside>
        </article>
      </section>
    </main>
  </nav>
</header>
```

---

## Animation & Transitions

### Timing Functions

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Durations

```css
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
```

### Common Animations

- **Fade In**: opacity 0 → 1
- **Slide Up**: translateY(20px) → 0
- **Scale**: scale(0.95) → 1
- **Scan Line**: translateY animation
- **Pulse**: scale animation loop

---

## Implementation Status

| Screen           | Design | Frontend | Backend | Status |
| ---------------- | ------ | -------- | ------- | ------ |
| Health Passport  | ✅     | ✅       | ✅      | Live   |
| Records Library  | ✅     | ✅       | ✅      | Live   |
| Doctor's Insight | ✅     | ✅       | ✅      | Live   |
| Voice Dashboard  | ✅     | ✅       | ✅      | Live   |
| AI Scanner       | ✅     | ✅       | ✅      | Live   |
| Health Timeline  | ✅     | ✅       | ✅      | Live   |

---

## Deployment

### Production URL

https://vaidya-link.vercel.app/

### Screen URLs

1. Health Passport: https://vaidya-link.vercel.app/vaidyalink/health-passport
2. Records Library: https://vaidya-link.vercel.app/vaidyalink/records
3. Doctor's Insight: https://vaidya-link.vercel.app/vaidyalink/doctor-portal
4. Voice Dashboard: https://vaidya-link.vercel.app/vaidyalink/voice
5. AI Scanner: https://vaidya-link.vercel.app/vaidyalink/scanner
6. Health Timeline: https://vaidya-link.vercel.app/vaidyalink/timeline

---

## Manual Download Instructions

To download the Stitch screens manually:

1. Visit the Stitch project: https://stitch.new/project/14580138233997456824
2. For each screen, click on the screen name
3. Use the export/download options to get:
   - High-resolution PNG images
   - React/Next.js code
   - CSS styles
   - Component specifications

### Alternative: Screenshot Method

If direct download is not available:

```bash
# Using browser DevTools or screenshot tools
# 1. Open each screen URL in browser
# 2. Set viewport to 430px width (iPhone 14 Pro Max)
# 3. Take full-page screenshot
# 4. Save to design/stitch-screens/
```

---

## Code Export

The Stitch platform may provide code export in these formats:

- React components (.tsx)
- CSS modules (.module.css)
- Tailwind classes
- Styled components
- Plain CSS

Our implementation uses:

- Next.js 16 with App Router
- TypeScript
- CSS modules (vaidyalink.css)
- React hooks for state management

---

## Design Tokens

All design tokens are centralized in:

- `frontend/app/vaidyalink/vaidyalink.css`

This ensures consistency across all screens and makes theme updates easy.

---

## Notes

- All screens are fully responsive (mobile-first)
- Dark mode support on all screens
- Accessibility compliant (WCAG 2.1 AA)
- Performance optimized (< 2s load time)
- Demo mode available for testing without backend

---

**Last Updated**: March 9, 2026
**Version**: 1.0
**Status**: Production Ready ✅
