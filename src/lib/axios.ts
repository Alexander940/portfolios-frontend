import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorResponse } from '@/types';
import { transformAxiosError } from './apiErrors';

/**
 * Axios configuration and instance
 *
 * Features:
 * - Automatic token injection via Authorization header
 * - Request/Response interceptors
 * - Centralized error handling
 * - Development logging
 * - Configurable timeout
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);

/**
 * Main API client instance
 * Uses JSON as default content type
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// =============================================================================
// Token Management
// =============================================================================

/**
 * Token getter function - will be set by auth store
 */
let getAccessToken: () => string | null = () => null;

/**
 * Auth error handler - will be set by auth store
 */
let handleAuthError: () => void = () => {};

/**
 * Configure axios with auth callbacks from the store
 * Called during app initialization
 */
export function configureAxiosAuth(callbacks: {
  getToken: () => string | null;
  onAuthError: () => void;
}) {
  getAccessToken = callbacks.getToken;
  handleAuthError = callbacks.onAuthError;
}

// =============================================================================
// Request Interceptor
// =============================================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Inject auth token if available
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Development logging
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// =============================================================================
// Response Interceptor
// =============================================================================

apiClient.interceptors.response.use(
  (response) => {
    // Development logging
    if (import.meta.env.DEV) {
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`,
        response.status
      );
    }
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // Development logging
    if (import.meta.env.DEV) {
      console.error(
        `[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response?.status,
        error.response?.data
      );
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Only trigger auth error if we had a token (not during login)
      const token = getAccessToken();
      if (token) {
        handleAuthError();
      }
    }

    // Transform to standardized ApiError
    const apiError = transformAxiosError(error);
    return Promise.reject(apiError);
  }
);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a cancel token source for request cancellation
 * Usage:
 * const { token, cancel } = createCancelToken();
 * apiClient.get('/endpoint', { cancelToken: token });
 * cancel(); // To cancel the request
 */
export function createCancelToken() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

export default apiClient;
