/**
 * Global type definitions for the application
 */

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

// API error response
export interface ApiError {
  message: string;
  code?: string;
  status: number;
  errors?: Record<string, string[]>;
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

// Base entity with common fields
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// User entity
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  isEmailVerified: boolean;
}

export type UserRole = 'admin' | 'user' | 'viewer';

// Utility type for making specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for form state
export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
