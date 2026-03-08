import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { sessionStorage } from '@/lib/auth/session-storage';
import { getTokenRefreshService } from '@/lib/auth/token-refresh';
import { requiresSignature, generateSignedHeaders, getUserSigningSecret } from './request-signing';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Queue for requests waiting for token refresh
interface QueuedRequest {
  resolve: (config: InternalAxiosRequestConfig) => void;
  reject: (error: any) => void;
  config: InternalAxiosRequestConfig;
}

let isRefreshing = false;
let requestQueue: QueuedRequest[] = [];

/**
 * Process queued requests after token refresh
 */
function processQueue(error: any = null, token: string | null = null) {
  requestQueue.forEach((request) => {
    if (error) {
      request.reject(error);
    } else {
      if (token) {
        request.config.headers.Authorization = `Bearer ${token}`;
      }
      request.resolve(request.config);
    }
  });
  requestQueue = [];
}

// Request interceptor for adding auth token and request signing
apiClient.interceptors.request.use(
  async (config) => {
    // Skip auth for public endpoints
    if (config.url?.includes('/public/')) {
      return config;
    }

    const tokens = sessionStorage.getTokens();

    if (!tokens) {
      return config;
    }

    // Check if token needs refresh
    if (sessionStorage.areTokensExpired(5)) {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const tokenRefreshService = getTokenRefreshService();
          const result = await tokenRefreshService.refreshTokens();

          if (result.success && result.tokens) {
            isRefreshing = false;
            processQueue(null, result.tokens.idToken);
            config.headers.Authorization = `Bearer ${result.tokens.idToken}`;
          } else {
            isRefreshing = false;
            processQueue(new Error('Token refresh failed'), null);
            throw new Error('Token refresh failed');
          }
        } catch (error) {
          isRefreshing = false;
          processQueue(error, null);
          throw error;
        }
      } else {
        // Queue this request while refresh is in progress
        return new Promise<InternalAxiosRequestConfig>((resolve, reject) => {
          requestQueue.push({ resolve, reject, config });
        });
      }
    } else {
      // Add current token to request
      config.headers.Authorization = `Bearer ${tokens.idToken}`;
    }

    // Add request signature for sensitive operations
    const path = config.url || '';
    if (requiresSignature(path)) {
      try {
        const secret = await getUserSigningSecret();
        const signedHeaders = generateSignedHeaders({
          method: config.method?.toUpperCase() || 'GET',
          path,
          body: config.data,
          secret,
        });

        // Add signature headers
        config.headers['X-VaidyaLink-Signature'] = signedHeaders['X-VaidyaLink-Signature'];
        config.headers['X-VaidyaLink-Timestamp'] = signedHeaders['X-VaidyaLink-Timestamp'];
      } catch (error) {
        console.error('Failed to sign request:', error);
        // Continue without signature - backend will reject if required
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const tokenRefreshService = getTokenRefreshService();
          const result = await tokenRefreshService.refreshTokens();

          if (result.success && result.tokens) {
            isRefreshing = false;
            processQueue(null, result.tokens.idToken);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${result.tokens.idToken}`;
            return apiClient(originalRequest);
          } else {
            // Refresh failed, logout user
            isRefreshing = false;
            processQueue(new Error('Token refresh failed'), null);
            sessionStorage.clearTokens();

            // Redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }

            return Promise.reject(error);
          }
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);
          sessionStorage.clearTokens();

          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }

          return Promise.reject(refreshError);
        }
      } else {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          requestQueue.push({
            resolve: (config) => resolve(apiClient(config)),
            reject: (err) => reject(err),
            config: originalRequest,
          });
        });
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
    }

    if (error.response && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
