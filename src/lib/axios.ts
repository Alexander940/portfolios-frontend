import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types';

/**
 * Axios instance configured for the API
 *
 * Features:
 * - Automatic token injection from auth store
 * - Response interceptor for error handling
 * - Request interceptor for auth headers
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (set by auth store when rememberMe is true)
    // or from the auth store directly via a callback
    const token = getAccessToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors (unauthorized) - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token
        const refreshed = await refreshAccessToken();

        if (refreshed && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed, redirect to login
        handleAuthError();
      }
    }

    // Transform error to a consistent format
    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      code: error.response?.data?.code,
      status: error.response?.status || 500,
      errors: error.response?.data?.errors,
    };

    return Promise.reject(apiError);
  }
);

// Token management callbacks - will be set by auth store
let getAccessToken: () => string | null = () => null;
let refreshAccessToken: () => Promise<boolean> = async () => false;
let handleAuthError: () => void = () => {};

/**
 * Configure axios with auth callbacks from the store
 * This is called during app initialization
 */
export function configureAxiosAuth(callbacks: {
  getToken: () => string | null;
  refreshToken: () => Promise<boolean>;
  onAuthError: () => void;
}) {
  getAccessToken = callbacks.getToken;
  refreshAccessToken = callbacks.refreshToken;
  handleAuthError = callbacks.onAuthError;
}

export default apiClient;
