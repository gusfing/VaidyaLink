'use client';

/**
 * ProcessingMonitor Component
 *
 * Polls the API for job status and displays real-time processing progress.
 * Automatically navigates to results page when processing completes.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJobStatus } from '@/lib/document-scan-demo/queries';
import { useToast } from './ToastContainer';
import type { ProcessingStage } from '@/lib/document-scan-demo/types';

interface ProcessingMonitorProps {
  jobId: string;
  onComplete?: () => void;
}

/**
 * Map processing stages to progress percentages
 */
const STAGE_PROGRESS: Record<ProcessingStage, number> = {
  uploading: 20,
  processing: 50,
  extracting: 70,
  transforming: 90,
  complete: 100,
  failed: 0,
};

/**
 * Map processing stages to display messages
 */
const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  uploading: 'Uploading document...',
  processing: 'Processing document...',
  extracting: 'Extracting text and data...',
  transforming: 'Transforming to FHIR format...',
  complete: 'Processing complete!',
  failed: 'Processing failed',
};

/**
 * Timeout duration in milliseconds (60 seconds)
 */
const TIMEOUT_DURATION = 60 * 1000;

export default function ProcessingMonitor({ jobId, onComplete }: ProcessingMonitorProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Poll job status every 2 seconds
  const { data: statusData, error, isError } = useJobStatus(jobId, !hasTimedOut);

  const status = statusData?.status || 'processing';
  const progress = STAGE_PROGRESS[status];
  const message = statusData?.message || STAGE_MESSAGES[status];
  const errorMessage = statusData?.error;

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Check for timeout
      if (elapsed >= TIMEOUT_DURATION) {
        setHasTimedOut(true);
        showError('Processing timed out. Please try again with a different document.');
        console.error('Processing timeout:', { jobId, elapsed });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, showError]);

  // Handle completion
  useEffect(() => {
    if (status === 'complete') {
      if (onComplete) {
        onComplete();
      } else {
        // Navigate to results page
        router.push(`/document-scan-demo/results/${jobId}`);
      }
    }
  }, [status, jobId, router, onComplete]);

  // Format elapsed time as MM:SS
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Render error state
  if (hasTimedOut) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-center">
            <svg
              className="mr-3 h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-red-900">Processing Timed Out</h3>
          </div>
          <p className="mb-4 text-red-700">
            Processing timed out. Please try again with a different document.
          </p>
          <button
            onClick={() => router.push('/document-scan-demo')}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow-md focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isError || status === 'failed') {
    const displayError = errorMessage || error?.message || 'An unknown error occurred';

    // Show toast notification for error
    useEffect(() => {
      if (isError || status === 'failed') {
        showError(displayError);
        console.error('Processing error:', { jobId, error: displayError });
      }
    }, [isError, status, displayError, showError, jobId]);

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-center">
            <svg
              className="mr-3 h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-red-900">Processing Failed</h3>
          </div>
          <p className="mb-4 text-red-700">{displayError}</p>
          <button
            onClick={() => router.push('/document-scan-demo')}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow-md focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render processing state
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Processing Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <svg className="h-20 w-20 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 animate-pulse rounded-full bg-blue-100"></div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">
          {STAGE_MESSAGES[status]}
        </h2>
        {message && message !== STAGE_MESSAGES[status] && (
          <p className="mb-6 text-center text-gray-600">{message}</p>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="text-center text-sm text-gray-500">
          Elapsed time: {formatTime(elapsedTime)}
        </div>

        {/* Processing Stages */}
        <div className="mt-8 space-y-2">
          {(
            [
              'uploading',
              'processing',
              'extracting',
              'transforming',
              'complete',
            ] as ProcessingStage[]
          ).map((stage) => {
            const isComplete = STAGE_PROGRESS[stage] <= progress;
            const isCurrent = stage === status;

            return (
              <div key={stage} className="flex items-center transition-all duration-300">
                <div
                  className={`mr-3 flex h-4 w-4 items-center justify-center rounded-full transition-all duration-300 ${
                    isComplete
                      ? 'scale-110 bg-blue-600'
                      : isCurrent
                        ? 'scale-105 animate-pulse bg-blue-300'
                        : 'bg-gray-300'
                  }`}
                >
                  {isComplete && stage !== status && (
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm transition-all duration-300 ${
                    isComplete || isCurrent ? 'font-medium text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {STAGE_MESSAGES[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
