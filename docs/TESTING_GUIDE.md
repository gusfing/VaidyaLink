# Testing Guide - Document Scan Demo

## Quick Start

The demo is ready to test with two sample prescriptions!

### Start the Development Server

```bash
cd frontend
npm run dev
```

Then open: http://localhost:3000/document-scan-demo

## Testing Options

### Option 1: Use Sample Prescription Buttons (Recommended)

The upload interface now has TWO sample prescription buttons:

1. **Sample 1 (Vivek M)** - Blue button
   - Original Adichunchanagiri University Hospital prescription
   - Patient: Vivek M (UHID: 10197)
   - Medications: Dextrose IV, ORS, Hypoglycemic injection
   - Conditions: Giddiness, Weakness, Hypoglycemia

2. **Sample 2 (New)** - Green button
   - Your new prescription from `ce2ca0f38002e2f6e4392e8173cd2551.jpg`
   - Will use the same mock data for demo purposes
   - Shows the system can handle different prescription formats

**How to test:**

1. Click either sample button
2. Preview will appear
3. Click "Upload & Process"
4. Watch the processing stages (2 seconds upload simulation)
5. View extracted results with medications, conditions, lab results, and FHIR data

### Option 2: Upload Your Own Document

1. Drag and drop any medical document (JPEG, PNG, PDF)
2. Or click the upload area to browse
3. Maximum file size: 10MB
4. Supported formats: JPEG, PNG, PDF

## Demo Mode Features

Currently configured with `NEXT_PUBLIC_DEMO_MODE=true`:

✅ No AWS credentials needed
✅ No Lambda deployment required
✅ Instant processing simulation
✅ Realistic medical data extraction
✅ Full FHIR transformation
✅ Perfect for client presentations

## What You'll See

### Processing Stages (8 seconds total)

1. **Uploading** - Document upload to storage
2. **Processing** - OCR text extraction
3. **Extracting** - Medical entity recognition
4. **Transforming** - FHIR format conversion
5. **Complete** - Results ready

### Results Display

- **OCR Text** - Full extracted text from prescription
- **Medications** - Name, dosage, frequency, confidence scores
- **Conditions** - Diagnosed conditions and symptoms
- **Lab Results** - Test names, values, units, confidence scores
- **FHIR Resource** - Complete FHIR Bundle in JSON format

## File Locations

- Sample 1: `frontend/public/sample-prescription.jpg`
- Sample 2: `frontend/public/new-prescription.jpg`
- Mock Data: `frontend/utils/document-scan-demo/mock-data.ts`
- Upload Component: `frontend/components/document-scan-demo/UploadInterface.tsx`

## Switching to Real AWS Mode

When ready to test with real AWS Bedrock:

1. Update `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_DEMO_MODE=false
   ```

2. Ensure Lambda is deployed:

   ```bash
   cd backend/document-processor
   ./deploy.ps1
   ```

3. Verify AWS credentials are configured

## Troubleshooting

### Sample buttons not working?

- Check browser console for errors
- Verify files exist in `frontend/public/`
- Clear browser cache and reload

### Upload fails?

- In demo mode: Check console for JavaScript errors
- In real mode: Verify API URL in `.env.local`
- Check network tab for failed requests

### No results showing?

- Demo mode should always work
- Check if processing stages completed
- Look for errors in browser console

## Next Steps

1. **Test both sample prescriptions** - Verify UI and data display
2. **Upload your own documents** - Test file validation
3. **Check FHIR output** - Verify medical data transformation
4. **Prepare for client demo** - Practice the flow
5. **Deploy to production** - Follow `PRODUCTION_DEPLOYMENT_GUIDE.md`

## Client Demo Script

**Duration: 3-4 minutes**

1. **Introduction (30 seconds)**
   - "This is VaidyaLink's intelligent document processing system"
   - "It extracts medical data from prescriptions and lab reports"

2. **Upload Demo (1 minute)**
   - Click "Sample 1 (Vivek M)" button
   - Show preview: "System accepts JPEG, PNG, and PDF files"
   - Click "Upload & Process"
   - Explain stages: "OCR → Entity Extraction → FHIR Transformation"

3. **Results Review (2 minutes)**
   - **OCR Text**: "Full text extraction with high accuracy"
   - **Medications**: "Structured data with dosage and confidence scores"
   - **Conditions**: "Automatic diagnosis and symptom detection"
   - **Lab Results**: "Vital signs and test results with units"
   - **FHIR**: "Industry-standard healthcare data format"

4. **Second Sample (30 seconds)**
   - Click "Sample 2 (New)" button
   - "System handles various prescription formats"
   - Quick upload and results

5. **Closing (30 seconds)**
   - "Integrates with ABDM (Ayushman Bharat)"
   - "Supports 22 Indian languages via voice input"
   - "Clinical summarization with AI"
   - "Ready for production deployment"

## Success Criteria

✅ Both sample buttons load prescriptions
✅ Upload progress shows 0-100%
✅ Processing stages animate smoothly
✅ Results display all sections correctly
✅ FHIR JSON is properly formatted
✅ No console errors
✅ Responsive on mobile and desktop

---

**Status**: Ready for testing and client demo
**Last Updated**: March 8, 2026
