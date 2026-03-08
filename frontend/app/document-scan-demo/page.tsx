'use client';

/**
 * Main Workflow Page
 *
 * Orchestrates the document scanning workflow:
 * 1. Show UploadInterface for file selection and upload OR VoiceRecorder for voice input
 * 2. Show ProcessingMonitor while document is being processed
 * 3. Navigate to results page when processing completes
 *
 * Manages state transitions between workflow steps.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/document-scan-demo/Header';
import UploadInterface from '@/components/document-scan-demo/UploadInterface';
import ProcessingMonitor from '@/components/document-scan-demo/ProcessingMonitor';
import VoiceRecorder, {
  type VoiceTranscriptionResult,
} from '@/components/document-scan-demo/VoiceRecorder';
import VoiceResults from '@/components/document-scan-demo/VoiceResults';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

type WorkflowState = 'upload' | 'processing' | 'voice-results';
type InputMode = 'document' | 'voice';

export default function DocumentScanDemoPage() {
  const [workflowState, setWorkflowState] = useState<WorkflowState>('upload');
  const [inputMode, setInputMode] = useState<InputMode>('document');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [voiceResult, setVoiceResult] = useState<VoiceTranscriptionResult | null>(null);
  const router = useRouter();

  /**
   * Handle upload completion
   * Transition from upload to processing state
   */
  const handleUploadComplete = (jobId: string) => {
    setCurrentJobId(jobId);
    setWorkflowState('processing');
  };

  /**
   * Handle voice transcription completion
   * Show voice results
   */
  const handleVoiceComplete = (result: VoiceTranscriptionResult) => {
    setVoiceResult(result);
    setWorkflowState('voice-results');
  };

  /**
   * Handle processing completion
   * Navigate to results page
   */
  const handleProcessingComplete = () => {
    if (currentJobId) {
      router.push(`/document-scan-demo/results/${currentJobId}`);
    }
  };

  /**
   * Handle starting a new scan
   * Reset to upload state
   */
  const handleNewScan = () => {
    setWorkflowState('upload');
    setCurrentJobId(null);
    setVoiceResult(null);
  };

  /**
   * Handle resetting voice recording
   */
  const handleVoiceReset = () => {
    setVoiceResult(null);
    setWorkflowState('upload');
  };

  return (
    <>
      {/* Header with workflow progress */}
      <Header currentStep={workflowState === 'voice-results' ? 'upload' : workflowState} />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {workflowState === 'upload' && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Medical Data Input</h2>
              <p className="mt-2 text-sm text-gray-600">
                Upload a medical document or record your medical history in your preferred language.
              </p>
            </div>

            {/* Input Mode Toggle */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
                <button
                  onClick={() => setInputMode('document')}
                  className={`rounded-md px-6 py-2 text-sm font-medium transition-all duration-200 ${
                    inputMode === 'document'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Upload Document</span>
                  </div>
                </button>
                <button
                  onClick={() => setInputMode('voice')}
                  className={`rounded-md px-6 py-2 text-sm font-medium transition-all duration-200 ${
                    inputMode === 'voice'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                    <span>Voice Recording</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Document Upload Interface */}
            {inputMode === 'document' && (
              <UploadInterface onUploadComplete={handleUploadComplete} />
            )}

            {/* Voice Recording Interface */}
            {inputMode === 'voice' && (
              <VoiceRecorder onTranscriptionComplete={handleVoiceComplete} />
            )}
          </div>
        )}

        {workflowState === 'processing' && currentJobId && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Processing Document</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your document is being processed. This may take a few moments.
              </p>
            </div>
            <ProcessingMonitor jobId={currentJobId} onComplete={handleProcessingComplete} />
            <div className="mt-6 text-center">
              <button
                onClick={handleNewScan}
                className="rounded text-sm text-blue-600 transition-colors duration-200 hover:text-blue-700 hover:underline focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                Cancel and start new scan
              </button>
            </div>
          </div>
        )}

        {workflowState === 'voice-results' && voiceResult && (
          <VoiceResults result={voiceResult} onReset={handleVoiceReset} />
        )}
      </main>
    </>
  );
}
