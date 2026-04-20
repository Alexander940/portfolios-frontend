import type { ApiError, ApiErrorResponse } from '@/types';
import type { AxiosError } from 'axios';

/**
 * API Error handling utilities
 *
 * Provides consistent error transformation and handling
 * for all API responses throughout the application.
 */

const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_ERROR: 'Connection error. Check your internet connection.',
  TIMEOUT: 'The request took too long. Please try again.',

  // Auth errors
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  EMAIL_EXISTS: 'This email is already registered.',
  USERNAME_EXISTS: 'This username is already taken.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',

  // Generic errors
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};

/**
 * Maps backend error details to user-friendly messages
 */
function mapErrorDetail(detail: string): string {
  const lowerDetail = detail.toLowerCase();

  if (lowerDetail.includes('incorrect email or password')) {
    return ERROR_MESSAGES.INVALID_CREDENTIALS;
  }
  if (lowerDetail.includes('email already registered')) {
    return ERROR_MESSAGES.EMAIL_EXISTS;
  }
  if (lowerDetail.includes('username already taken')) {
    return ERROR_MESSAGES.USERNAME_EXISTS;
  }

  // Return the original detail if no mapping found
  return detail;
}

/**
 * Transforms an Axios error into a standardized ApiError
 */
export function transformAxiosError(error: AxiosError<ApiErrorResponse>): ApiError {
  // Network error (no response)
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return {
        message: ERROR_MESSAGES.TIMEOUT,
        status: 0,
      };
    }
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      status: 0,
    };
  }

  const { status, data } = error.response;

  // Handle specific status codes
  switch (status) {
    case 401:
      return {
        message: data?.detail
          ? mapErrorDetail(data.detail)
          : ERROR_MESSAGES.UNAUTHORIZED,
        status,
        detail: data?.detail,
      };

    case 409:
      return {
        message: data?.detail
          ? mapErrorDetail(data.detail)
          : ERROR_MESSAGES.EMAIL_EXISTS,
        status,
        detail: data?.detail,
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        message: ERROR_MESSAGES.SERVER_ERROR,
        status,
        detail: data?.detail,
      };

    default:
      return {
        message: data?.detail
          ? mapErrorDetail(data.detail)
          : ERROR_MESSAGES.UNKNOWN_ERROR,
        status,
        detail: data?.detail,
      };
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'status' in error
  );
}

/**
 * Extracts a user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR;
}
