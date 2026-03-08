/**
 * UploadInterface Component
 *
 * Handles file selection and upload to S3 for document processing.
 * Features:
 * - Drag-and-drop and click-to-browse file selection
 * - File validation (JPEG, PNG, PDF, max 10MB)
 * - Image preview generation (PDF shows icon)
 * - Upload progress tracking
 * - Error handling with user-friendly messages
 * - Support for both demo mode and real AWS S3 uploads
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { getPresignedUrl, triggerProcessing } from '@/lib/document-scan-demo/api-client';
import { simulateUpload } from '@/utils/document-scan-demo/mock-data';
import { useToast } from './ToastContainer';

// Constants
const ACCEPTED_FILE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/pdf': ['.pdf'],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

interface UploadInterfaceProps {
  onUploadComplete: (jobId: string) => void;
}

export default function UploadInterface({ onUploadComplete }: UploadInterfaceProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useToast();

  /**
   * Handle file selection and validation
   */
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Clear previous errors
      setError(null);

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        let errorMessage = 'Invalid file. Please try again.';

        if (rejection.errors[0]?.code === 'file-too-large') {
          errorMessage = 'File too large. Maximum size is 10MB.';
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          errorMessage = 'Unsupported file format. Please upload JPEG, PNG, or PDF.';
        }

        setError(errorMessage);
        showError(errorMessage);
        console.error('File validation error:', rejection.errors);
        return;
      }

      // Handle accepted file
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);

        // Generate preview only for image files using FileReader API
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setPreviewUrl(null);
        }
      }
    },
    [showError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  /**
   * Handle file upload workflow
   * 1. Request pre-signed URL from API
   * 2. Upload file directly to S3 with progress tracking
   * 3. Trigger backend processing
   * 4. Call onUploadComplete callback with jobId
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Check if demo mode is enabled
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

      if (isDemoMode) {
        // Demo mode: Simulate upload with 2-second delay
        await simulateUpload(selectedFile, setUploadProgress, 2000);

        // Simulate getting pre-signed URL and triggering processing
        const { s3Key } = await getPresignedUrl(selectedFile.name);
        const { jobId } = await triggerProcessing(s3Key);

        onUploadComplete(jobId);
      } else {
        // Real mode: Actual S3 upload
        // Step 1: Request pre-signed URL
        const { uploadUrl, s3Key } = await getPresignedUrl(selectedFile.name);

        // Step 2: Upload file directly to S3 with progress tracking
        await axios.put(uploadUrl, selectedFile, {
          headers: {
            'Content-Type': selectedFile.type,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percentage);
            }
          },
        });

        // Step 3: Trigger backend processing
        const { jobId } = await triggerProcessing(s3Key);

        // Step 4: Call callback with jobId
        onUploadComplete(jobId);
      }
    } catch (err) {
      console.error('Upload failed:', err);

      // Determine user-friendly error message
      let errorMessage = 'Upload failed. Please try again.';

      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
          errorMessage = 'Unable to connect to server. Please check your connection.';
        } else if (err.response?.status === 401) {
          errorMessage = 'Session expired. Please log in again.';
        }
      }

      setError(errorMessage);
      showError(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Reset the upload interface
   */
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="space-y-6">
        {/* Dropzone Area */}
        {!selectedFile && (
          <>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all duration-300 ${isDragActive ? 'scale-[1.02] border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'} `}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-gray-600">
                  {isDragActive ? (
                    <p className="text-lg font-medium">Drop the file here</p>
                  ) : (
                    <>
                      <p className="text-lg font-medium">Drag and drop a medical document</p>
                      <p className="text-sm">or click to browse</p>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, JPEG, or PDF (max 10MB)</p>
              </div>
            </div>

            {/* Try Sample Document Buttons */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-300"></div>
                <span className="text-sm text-gray-500">or try a sample</span>
                <div className="h-px flex-1 bg-gray-300"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/sample-prescription.jpg');
                    const blob = await response.blob();
                    const file = new File([blob], 'sample-prescription.jpg', {
                      type: 'image/jpeg',
                    });

                    setSelectedFile(file);

                    // Generate preview
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setPreviewUrl(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  } catch (err) {
                    console.error('Failed to load sample document:', err);
                    showError('Failed to load sample document');
                  }
                }}
                className="w-full rounded-md border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Sample 1 (Vivek M)</span>
                </div>
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/new-prescription.jpg');
                    const blob = await response.blob();
                    const file = new File([blob], 'new-prescription.jpg', { type: 'image/jpeg' });

                    setSelectedFile(file);

                    // Generate preview
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setPreviewUrl(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  } catch (err) {
                    console.error('Failed to load new prescription:', err);
                    showError('Failed to load prescription');
                  }
                }}
                className="w-full rounded-md border-2 border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 transition-all duration-200 hover:border-green-300 hover:bg-green-100 hover:shadow-md focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Sample 2 (New)</span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Image Preview */}
        {selectedFile && !isUploading && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              {previewUrl && selectedFile.type !== 'application/pdf' ? (
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="mx-auto max-h-96 rounded shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg
                    className="h-16 w-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">PDF Document</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  Upload & Process
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Uploading...</span>
                  <span className="text-gray-600">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-start">
              <svg className="mt-0.5 h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
