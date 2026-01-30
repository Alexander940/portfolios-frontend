import type { User } from '@/types';

/**
 * Authentication-related type definitions
 * Based on auth-api.md documentation
 */

// =============================================================================
// Request Types
// =============================================================================

/**
 * Login credentials
 * Note: API uses OAuth2 password flow with form-urlencoded
 * The 'username' field actually expects the email
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Registration data
 * POST /auth/register - expects JSON body
 */
export interface RegisterData {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Login response from API
 * POST /auth/login returns: { access_token: string, token_type: "bearer" }
 */
export interface LoginApiResponse {
  access_token: string;
  token_type: string;
}

/**
 * Register response from API
 * POST /auth/register returns user data with optional fields
 */
export interface RegisterApiResponse {
  user_id: string;
  email: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Current user response from API
 * GET /auth/me returns: { id: number, username: string, email: string }
 */
export type CurrentUserResponse = User;

// =============================================================================
// Store Types
// =============================================================================

/**
 * Auth state for Zustand store
 */
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Auth actions for Zustand store
 */
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
  initialize: () => Promise<void>;
}

/**
 * Combined auth store type
 */
export type AuthStore = AuthState & AuthActions;
