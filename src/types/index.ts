/**
 * Global type definitions for the application
 */

// API error response from backend
// Backend returns: { detail: "error message" }
export interface ApiErrorResponse {
  detail: string;
}

// Internal API error for error handling
export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

// Pagination metadata
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * User entity as returned by the backend
 * Backend returns: { id: number, username: string, email: string }
 */
export interface User {
  id: number;
  username: string;
  email: string;
}

// Utility type for making specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for form state
export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
