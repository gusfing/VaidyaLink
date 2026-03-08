/**
 * API Client for Document Scan Demo
 *
 * This module provides a centralized HTTP client for backend communication
 * with authentication, retry logic, and error handling.
 */

import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { PresignedUrlResponse, JobStatusResponse, ProcessingResults } from './types';
import { mockApiResponses } from '@/utils/document-scan-demo/mock-data';

/**
 * Create and configure the Axios instance
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor: Add authentication token to all requests
 * NOTE: Authentication temporarily disabled for testing
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Skip authentication if SKIP_AUTH is enabled
    const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

    if (skipAuth) {
      console.log('SKIP_AUTH enabled - no authentication token added');
      return config;
    }

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to fetch auth session:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor: Handle 401 errors by redirecting to login
 * NOTE: Authentication temporarily disabled for testing
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log detailed error information for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    // Skip 401 redirect if SKIP_AUTH is enabled
    const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

    if (error.response?.status === 401 && !skipAuth) {
      // Redirect to login page with session expired message
      if (typeof window !== 'undefined') {
        console.log('Session expired, redirecting to login');
        window.location.href = '/document-scan-demo/login?reason=expired';
      }
    }

    // Enhance error message for better user feedback
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      error.userMessage = 'Unable to connect to server. Please check your connection.';
    } else if (error.response?.status === 401) {
      error.userMessage = skipAuth
        ? 'Authentication error (bypassed for testing)'
        : 'Session expired. Please log in again.';
    } else if (error.response?.status >= 500) {
      error.userMessage = 'Server error. Please try again later.';
    } else if (error.response?.status === 429) {
      error.userMessage = 'Too many requests. Please wait a moment and try again.';
    } else {
      error.userMessage = error.response?.data?.message || 'An error occurred. Please try again.';
    }

    return Promise.reject(error);
  }
);

/**
 * Configure retry logic with exponential backoff
 * - Retries: 3 attempts
 * - Delay: Exponential (1s, 2s, 4s)
 * - Conditions: Network errors, idempotent requests, rate limiting
 */
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  },
});

/**
 * API Client Methods
 */

/**
 * Check if demo mode is enabled
 */
function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Simulate delay for demo mode
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request a pre-signed S3 URL for file upload
 * @param filename - Name of the file to upload
 * @returns Pre-signed URL response with upload URL and S3 key
 */
export async function getPresignedUrl(filename: string): Promise<PresignedUrlResponse> {
  try {
    if (isDemoMode()) {
      await delay(500); // Simulate network delay
      return mockApiResponses.getPresignedUrl(filename);
    }

    const response = await apiClient.post<PresignedUrlResponse>('/upload/presigned-url', {
      filename,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get pre-signed URL:', error);
    throw error;
  }
}

/**
 * Trigger backend processing for an uploaded document
 * @param s3Key - S3 key of the uploaded file
 * @returns Job ID for tracking processing status
 */
export async function triggerProcessing(s3Key: string): Promise<{ jobId: string }> {
  try {
    if (isDemoMode()) {
      await delay(500); // Simulate network delay
      return mockApiResponses.triggerProcessing(s3Key);
    }

    const response = await apiClient.post<{ jobId: string }>('/jobs/process', {
      s3Key,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to trigger processing:', error);
    throw error;
  }
}

/**
 * Get the current status of a processing job
 * @param jobId - Job identifier
 * @returns Current job status and message
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  try {
    if (isDemoMode()) {
      await delay(300); // Simulate network delay
      // In demo mode, we'll return the status based on elapsed time
      // This will be handled by the ProcessingMonitor component
      return mockApiResponses.getJobStatus(jobId, 'processing');
    }

    const response = await apiClient.get<JobStatusResponse>(`/jobs/${jobId}/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to get job status:', error);
    throw error;
  }
}

/**
 * Get the complete results of a processed document
 * @param jobId - Job identifier
 * @returns Complete processing results including OCR, entities, and FHIR
 */
export async function getResults(jobId: string): Promise<ProcessingResults> {
  try {
    if (isDemoMode()) {
      await delay(500); // Simulate network delay
      return mockApiResponses.getResults(jobId);
    }

    const response = await apiClient.get<ProcessingResults>(`/jobs/${jobId}/results`);
    return response.data;
  } catch (error) {
    console.error('Failed to get results:', error);
    throw error;
  }
}

/**
 * Export the configured Axios instance for custom requests
 */
export { apiClient };
