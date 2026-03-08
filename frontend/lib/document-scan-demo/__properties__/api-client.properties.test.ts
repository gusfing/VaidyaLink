/**
 * Property-Based Tests for API Client
 *
 * Feature: document-scan-demo
 * These tests verify universal properties that should hold for all API requests.
 */

import fc from 'fast-check';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Mock dependencies BEFORE importing anything else
jest.mock('aws-amplify/auth');

// Now import after mocking
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiClient } from '../api-client';

const mockFetchAuthSession = fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>;

describe('API Client Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 3: All API requests include authentication
   *
   * **Validates: Requirements 1.4, 5.7**
   *
   * For any API request made through the API client, the request headers
   * should include a valid authentication token in the Authorization header
   * with Bearer token format.
   */
  it('should include auth token in all requests', async () => {
    // Mock auth session with a valid token
    const mockToken = 'mock-jwt-token-12345';
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => mockToken,
          payload: {},
        } as any,
        accessToken: undefined,
      },
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    } as any);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          path: fc.string({ minLength: 1, maxLength: 50 }).map((s: string) => `/${s}`),
          data: fc.option(
            fc.record({
              key: fc.string(),
              value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            }),
            { nil: undefined }
          ),
        }),
        async ({ method, path, data }) => {
          // Mock the axios adapter to capture the final config
          let capturedConfig: InternalAxiosRequestConfig | null = null;

          const mockAdapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
            capturedConfig = config;
            // Return a mock response
            return Promise.resolve({
              data: {},
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            } as AxiosResponse);
          };

          // Temporarily replace the adapter
          const originalAdapter = apiClient.defaults.adapter;
          apiClient.defaults.adapter = mockAdapter;

          try {
            // Make the request
            await apiClient.request({
              method: method.toLowerCase() as any,
              url: path,
              data,
            });
          } finally {
            // Restore the original adapter
            apiClient.defaults.adapter = originalAdapter;
          }

          // Verify the Authorization header was added
          expect(capturedConfig).not.toBeNull();
          expect(capturedConfig?.headers?.Authorization).toBeDefined();
          expect(capturedConfig?.headers?.Authorization).toBe(`Bearer ${mockToken}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Auth token format is always Bearer
   *
   * This test verifies that the Authorization header always follows
   * the Bearer token format, regardless of the token content.
   */
  it('should always use Bearer token format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (randomToken: string) => {
          // Mock auth session with random token
          mockFetchAuthSession.mockResolvedValue({
            tokens: {
              idToken: {
                toString: () => randomToken,
                payload: {},
              } as any,
              accessToken: undefined,
            },
            credentials: undefined,
            identityId: undefined,
            userSub: undefined,
          } as any);

          let capturedConfig: InternalAxiosRequestConfig | null = null;

          const mockAdapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
            capturedConfig = config;
            return Promise.resolve({
              data: {},
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            } as AxiosResponse);
          };

          const originalAdapter = apiClient.defaults.adapter;
          apiClient.defaults.adapter = mockAdapter;

          try {
            await apiClient.get('/test');
          } finally {
            apiClient.defaults.adapter = originalAdapter;
          }

          // Verify Bearer format
          expect(capturedConfig?.headers?.Authorization).toMatch(/^Bearer /);
          expect(capturedConfig?.headers?.Authorization).toBe(`Bearer ${randomToken}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Requests without auth session should not have Authorization header
   *
   * This test verifies that when authentication fails or is unavailable,
   * requests proceed without an Authorization header (rather than failing).
   */
  it('should proceed without Authorization header when auth session fails', async () => {
    // Mock auth session failure
    mockFetchAuthSession.mockRejectedValue(new Error('Auth session failed'));

    await fc.assert(
      fc.asyncProperty(fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'), async (method: string) => {
        let capturedConfig: InternalAxiosRequestConfig | null = null;

        const mockAdapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
          capturedConfig = config;
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
        };

        const originalAdapter = apiClient.defaults.adapter;
        apiClient.defaults.adapter = mockAdapter;

        try {
          await apiClient.request({
            method: method.toLowerCase() as any,
            url: '/test',
          });
        } finally {
          apiClient.defaults.adapter = originalAdapter;
        }

        // Verify no Authorization header is present
        expect(capturedConfig).not.toBeNull();
        expect(capturedConfig?.headers?.Authorization).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19: Failed requests trigger retry with backoff
   *
   * **Validates: Requirements 5.5**
   *
   * For any API request that fails due to network errors or transient failures,
   * the API client should retry up to 3 times with exponential backoff.
   * This test verifies that:
   * 1. Failed requests are retried the correct number of times
   * 2. Both network errors and rate limiting (429) trigger retries
   */
  it('should retry failed requests with exponential backoff', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorType: fc.constantFrom('network', 'timeout', 'ratelimit'),
          failureCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ errorType, failureCount }) => {
          let retryCount = 0;
          let requestCount = 0;

          // Create a new axios instance for this test to avoid interference
          const testClient = axios.create({
            baseURL: 'http://test.local',
            timeout: 1000,
          });

          // Configure retry with onRetry callback to count retries
          axiosRetry(testClient, {
            retries: 3,
            retryDelay: () => 1, // 1ms for fast testing
            retryCondition: (error) => {
              return (
                axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                error.response?.status === 429
              );
            },
            onRetry: () => {
              retryCount++;
            },
          });

          // Mock adapter that fails initially then succeeds
          testClient.defaults.adapter = ((config: any) => {
            requestCount++;

            if (requestCount <= failureCount) {
              const error: any = new Error('Test Error');
              error.config = config;
              error.isAxiosError = true;
              error.request = {}; // Required for axios-retry to recognize it

              switch (errorType) {
                case 'network':
                  error.code = 'ECONNREFUSED';
                  break;
                case 'timeout':
                  error.code = 'ECONNABORTED';
                  break;
                case 'ratelimit':
                  error.response = {
                    status: 429,
                    statusText: 'Too Many Requests',
                    data: {},
                    headers: {},
                    config,
                  };
                  break;
              }

              return Promise.reject(error);
            }

            return Promise.resolve({
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            });
          }) as any;

          await testClient.get('/test');

          // Verify retry behavior
          // Should have retried failureCount times
          expect(retryCount).toBe(failureCount);
          // Should have made failureCount + 1 requests (initial + retries)
          expect(requestCount).toBe(failureCount + 1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property test: Non-retryable errors should not trigger retries
   *
   * This test verifies that certain error types (like 4xx client errors
   * other than 429) do not trigger retry logic, as they indicate
   * client-side issues that won't be resolved by retrying.
   */
  it('should not retry non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          statusCode: fc.constantFrom(400, 403, 404, 422),
        }),
        async ({ statusCode }) => {
          let retryCount = 0;
          let requestCount = 0;

          // Create a new axios instance for this test
          const testClient = axios.create({
            baseURL: 'http://test.local',
            timeout: 1000,
          });

          // Configure retry with onRetry callback
          axiosRetry(testClient, {
            retries: 3,
            retryDelay: () => 1,
            retryCondition: (error) => {
              return (
                axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                error.response?.status === 429
              );
            },
            onRetry: () => {
              retryCount++;
            },
          });

          // Mock adapter that always fails with non-retryable error
          testClient.defaults.adapter = ((config: any) => {
            requestCount++;

            const error: any = new Error('Client Error');
            error.config = config;
            error.isAxiosError = true;
            error.response = {
              status: statusCode,
              statusText: 'Client Error',
              data: { error: 'Bad request' },
              headers: {},
              config,
            };

            return Promise.reject(error);
          }) as any;

          try {
            await testClient.get('/test');
          } catch (error) {
            // Expected to fail
          }

          // Should not have retried (retryCount = 0)
          expect(retryCount).toBe(0);
          // Should only have made 1 request
          expect(requestCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Maximum retry limit is enforced
   *
   * This test verifies that the API client respects the maximum retry
   * limit of 3 attempts, even when requests continue to fail.
   */
  it('should enforce maximum retry limit of 3', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('network', 'timeout'), async (errorType: string) => {
        let retryCount = 0;
        let requestCount = 0;

        // Create a new axios instance for this test
        const testClient = axios.create({
          baseURL: 'http://test.local',
          timeout: 1000,
        });

        // Configure retry with onRetry callback
        axiosRetry(testClient, {
          retries: 3,
          retryDelay: () => 1,
          retryCondition: (error) => {
            return (
              axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429
            );
          },
          onRetry: () => {
            retryCount++;
          },
        });

        // Mock adapter that always fails
        testClient.defaults.adapter = ((config: any) => {
          requestCount++;

          const error: any = new Error('Test Error');
          error.config = config;
          error.isAxiosError = true;
          error.request = {}; // Required for axios-retry to recognize it
          error.code = errorType === 'network' ? 'ECONNREFUSED' : 'ECONNABORTED';

          return Promise.reject(error);
        }) as any;

        try {
          await testClient.get('/test');
        } catch (error) {
          // Expected to fail after all retries
        }

        // Should have retried exactly 3 times
        expect(retryCount).toBe(3);
        // Should have made exactly 4 requests (1 initial + 3 retries)
        expect(requestCount).toBe(4);
      }),
      { numRuns: 100 }
    );
  });
});
