import type { User } from '@/types';

/**
 * Authentication-related type definitions
 */

// Login form data
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Registration form data
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Authentication tokens
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Login response from API
export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Auth state for the store
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth actions for the store
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

// Combined auth store type
export type AuthStore = AuthState & AuthActions;

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset confirmation
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
