'use client';

import { useState, useRef } from 'react';
import { getPresignedUrl } from '@/lib/document-scan-demo/api-client';
import { uploadToS3, processDocument } from '@/lib/vaidyalink/api-client';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Process the image
    await processImage(file);
  };

  const processImage = async (file: File) => {
    setScanning(true);
    setProcessing(true);
    setError(null);

    try {
      // Step 1: Get presigned URL for upload
      const { uploadUrl, s3Key } = await getPresignedUrl(file.name);

      // Step 2: Upload to S3
      await uploadToS3(uploadUrl, file, file.type);

      // Step 3: Process document
      const processingResults = await processDocument(s3Key);

      setResults(processingResults);
      setScanning(false);
      setProcessing(false);
    } catch (err) {
      console.error('Failed to process document:', err);
      setError('Failed to process document. Please try again.');
      setScanning(false);
      setProcessing(false);
    }
  };

  const handleScan = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setCapturedImage(null);
    setResults(null);
    setError(null);
    setScanning(false);
    setProcessing(false);
  };

  return (
    <div className="scanner-page">
      <h1>AI Document Scanner</h1>
      <p className="subtitle">Scan and digitize medical documents</p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!results && (
        <div className="scanner-container">
          <div className="camera-viewfinder">
            <div className="scanning-frame">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
              {scanning && <div className="scan-line"></div>}
            </div>
            {capturedImage ? (
              <img src={capturedImage} alt="Captured document" className="captured-image" />
            ) : (
              <div className="camera-placeholder">
                <span className="material-symbols-outlined">photo_camera</span>
                <p>Camera viewfinder</p>
              </div>
            )}
          </div>

          {processing && (
            <div className="progress-indicator">
              <div className="spinner"></div>
              <p>Processing document...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="material-symbols-outlined">error</span>
              <p>{error}</p>
            </div>
          )}

          <button onClick={handleScan} disabled={scanning || processing} className="scan-btn">
            <span className="material-symbols-outlined">
              {processing ? 'hourglass_empty' : 'document_scanner'}
            </span>
            {processing ? 'Processing...' : capturedImage ? 'Scan Another' : 'Select Document'}
          </button>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="results-container">
          <div className="results-header">
            <h2>Extracted Data</h2>
            <button onClick={handleReset} className="reset-btn">
              <span className="material-symbols-outlined">refresh</span>
              Scan Another
            </button>
          </div>

          {/* OCR Text */}
          <div className="info-card">
            <h3>
              <span className="material-symbols-outlined">text_fields</span>
              OCR Text
            </h3>
            <pre className="ocr-text">{results.ocrText}</pre>
          </div>

          {/* Extracted Entities */}
          {results.entities && results.entities.length > 0 && (
            <div className="info-card">
              <h3>
                <span className="material-symbols-outlined">label</span>
                Extracted Entities
              </h3>
              <div className="entities-grid">
                {results.entities.map((entity, i) => (
                  <div key={i} className="entity-item">
                    <span className="entity-type">{entity.type}</span>
                    <span className="entity-text">{entity.text}</span>
                    <span className="entity-confidence">
                      {(entity.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {results.medications && results.medications.length > 0 && (
            <div className="info-card">
              <h3>
                <span className="material-symbols-outlined">medication</span>
                Medications
              </h3>
              {results.medications.map((med, i) => (
                <div key={i} className="med-item">
                  <strong>{med.name}</strong>
                  <span>
                    {med.dosage} • {med.frequency}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Conditions */}
          {results.conditions && results.conditions.length > 0 && (
            <div className="info-card">
              <h3>
                <span className="material-symbols-outlined">health_and_safety</span>
                Conditions
              </h3>
              <div className="conditions-list">
                {results.conditions.map((condition, i) => (
                  <span key={i} className="condition-tag">
                    {condition}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">info</span>
          How to scan
        </h3>
        <ul>
          <li>Place document within the scanning frame</li>
          <li>Ensure good lighting and focus</li>
          <li>Tap "Confirm & Structure" to process</li>
          <li>AI will extract medical entities automatically</li>
        </ul>
      </div>
    </div>
  );
}
