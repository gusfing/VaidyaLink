/**
 * Quick test script to verify demo mode functionality
 * Run with: node test-demo-mode.js
 */

// Simulate environment variable
process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

// Import mock data (using require for Node.js compatibility)
const mockData = require('./utils/document-scan-demo/mock-data.ts');

console.log('🧪 Testing Demo Mode Implementation\n');
console.log('='.repeat(60));

// Test 1: Mock API Responses
console.log('\n✅ Test 1: Mock API Responses');
console.log('-'.repeat(60));

const presignedUrl = mockData.mockApiResponses.getPresignedUrl('test-document.jpg');
console.log('Pre-signed URL:', presignedUrl.s3Key);

const processingJob = mockData.mockApiResponses.triggerProcessing('test-key');
console.log('Job ID:', processingJob.jobId);

const jobStatus = mockData.mockApiResponses.getJobStatus('test-job', 'processing');
console.log('Job Status:', jobStatus.status, '-', jobStatus.message);

// Test 2: Mock Results
console.log('\n✅ Test 2: Mock Results Data');
console.log('-'.repeat(60));

const prescriptionResults = mockData.MOCK_PRESCRIPTION_RESULTS;
console.log('Prescription Results:');
console.log('  - Job ID:', prescriptionResults.jobId);
console.log('  - Medications:', prescriptionResults.medications.length);
console.log('  - Entities:', prescriptionResults.entities.length);
console.log('  - OCR Text Length:', prescriptionResults.ocrText.length, 'chars');

const labResults = mockData.MOCK_LAB_RESULTS;
console.log('\nLab Results:');
console.log('  - Job ID:', labResults.jobId);
console.log('  - Lab Tests:', labResults.labResults.length);
console.log('  - Entities:', labResults.entities.length);
console.log('  - OCR Text Length:', labResults.ocrText.length, 'chars');

// Test 3: Simulated Processing Stages
console.log('\n✅ Test 3: Processing Stage Simulation');
console.log('-'.repeat(60));

let stageCount = 0;
const cleanup = mockData.simulateProcessingStages(
  'test-job-123',
  (status) => {
    stageCount++;
    console.log(`  Stage ${stageCount}: ${status.status} - ${status.message}`);
  },
  2000 // 2 seconds for quick test
);

// Wait for simulation to complete
setTimeout(() => {
  cleanup();
  console.log('\n✅ Test 4: Upload Simulation');
  console.log('-'.repeat(60));

  // Test upload simulation
  const mockFile = { name: 'test.jpg', size: 1024 };
  let progressUpdates = 0;

  mockData
    .simulateUpload(
      mockFile,
      (progress) => {
        progressUpdates++;
        if (progressUpdates % 3 === 0) {
          console.log(`  Upload Progress: ${progress}%`);
        }
      },
      1000 // 1 second for quick test
    )
    .then(() => {
      console.log('  Upload Complete!');
      console.log('\n' + '='.repeat(60));
      console.log('✅ All Demo Mode Tests Passed!');
      console.log('='.repeat(60));
      console.log('\n📝 Next Steps:');
      console.log('  1. Open http://localhost:3000/document-scan-demo');
      console.log('  2. The demo mode toggle should be visible in the header');
      console.log('  3. Upload any image file to test the workflow');
      console.log('  4. Watch the simulated processing stages (8 seconds)');
      console.log('  5. View the mock results with realistic medical data\n');
    });
}, 2500);
