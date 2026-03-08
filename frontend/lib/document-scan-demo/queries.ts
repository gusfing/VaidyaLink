/**
 * React Query hooks for Document Scan Demo
 *
 * This module provides React Query hooks for server state management,
 * including status polling and results fetching.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { getJobStatus, getResults } from './api-client';
import type { JobStatusResponse, ProcessingResults, ProcessingStage } from './types';
import { mockApiResponses } from '@/utils/document-scan-demo/mock-data';

/**
 * Check if demo mode is enabled
 */
function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Get simulated processing stage based on elapsed time in demo mode
 * Simulates 8-second processing duration
 */
function getDemoStage(startTime: number): ProcessingStage {
  const elapsed = Date.now() - startTime;
  const duration = 8000; // 8 seconds total

  if (elapsed < duration * 0.2) return 'uploading';
  if (elapsed < duration * 0.4) return 'processing';
  if (elapsed < duration * 0.6) return 'extracting';
  if (elapsed < duration * 0.8) return 'transforming';
  return 'complete';
}

/**
 * Hook for polling job status
 *
 * Polls the API every 2 seconds for job status updates.
 * Automatically stops polling when status is terminal (complete/failed).
 * Implements exponential backoff for failed polling requests.
 * In demo mode, simulates processing stages over 8 seconds.
 *
 * @param jobId - Job identifier to poll
 * @param enabled - Whether polling is enabled
 * @returns Query result with job status data
 */
export function useJobStatus(
  jobId: string,
  enabled: boolean = true
): UseQueryResult<JobStatusResponse, Error> {
  // Track start time for demo mode simulation
  const startTimeRef = useRef<number>(Date.now());
  // Track consecutive failures for exponential backoff
  const failureCountRef = useRef<number>(0);

  return useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: async () => {
      if (isDemoMode()) {
        // Demo mode: Return simulated status based on elapsed time
        const stage = getDemoStage(startTimeRef.current);
        return mockApiResponses.getJobStatus(jobId, stage);
      }

      // Real mode: Fetch from API
      try {
        const status = await getJobStatus(jobId);
        // Reset failure count on success
        failureCountRef.current = 0;
        return status;
      } catch (error) {
        // Increment failure count for exponential backoff
        failureCountRef.current += 1;
        throw error;
      }
    },
    enabled,
    refetchInterval: (query) => {
      // Stop polling if status is terminal (complete or failed)
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') {
        return false;
      }

      // Implement exponential backoff for failed requests
      // Base interval: 2 seconds
      // After failures: 2s, 4s, 8s, 16s, 32s (capped at 32s)
      const baseInterval = 2000;
      const backoffMultiplier = Math.pow(2, Math.min(failureCountRef.current, 4));
      const interval = baseInterval * backoffMultiplier;

      return interval;
    },
    // Keep data fresh during polling
    staleTime: 0,
    // Retry with exponential backoff (up to 5 retries)
    retry: 5,
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      return Math.min(1000 * Math.pow(2, attemptIndex), 16000);
    },
  });
}

/**
 * Hook for fetching complete processing results
 *
 * @param jobId - Job identifier
 * @param enabled - Whether fetching is enabled
 * @returns Query result with processing results
 */
export function useProcessingResults(
  jobId: string,
  enabled: boolean = true
): UseQueryResult<ProcessingResults, Error> {
  return useQuery({
    queryKey: ['processingResults', jobId],
    queryFn: async () => {
      const results = await getResults(jobId);
      return results;
    },
    enabled,
    // Results don't change once fetched
    staleTime: Infinity,
    // Cache results for 10 minutes
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });
}
