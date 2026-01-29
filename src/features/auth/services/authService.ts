import { apiClient } from '@/lib/axios';
import type {
  LoginCredentials,
  LoginResponse,
  PasswordResetRequest,
  RegisterData,
} from '../types';

/**
 * Authentication API service
 *
 * Handles all authentication-related HTTP requests.
 * In development mode, returns mock data for testing.
 */

const IS_DEV = import.meta.env.DEV;

// Mock data for development
const mockUser = {
  id: '1',
  email: 'demo@example.com',
  firstName: 'Demo',
  lastName: 'User',
  role: 'user' as const,
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTokens = {
  accessToken: 'mock-access-token-xyz',
  refreshToken: 'mock-refresh-token-xyz',
  expiresIn: 3600,
};

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    if (IS_DEV) {
      await delay(1000); // Simulate network delay

      // Mock validation
      if (credentials.email !== 'demo@example.com') {
        throw new Error('Credenciales inválidas');
      }
      if (credentials.password !== 'demo123') {
        throw new Error('Credenciales inválidas');
      }

      return { user: mockUser, tokens: mockTokens };
    }

    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<LoginResponse> {
    if (IS_DEV) {
      await delay(1000);
      return {
        user: { ...mockUser, ...data },
        tokens: mockTokens,
      };
    }

    const response = await apiClient.post<LoginResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Refresh the access token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    if (IS_DEV) {
      await delay(500);
      return { user: mockUser, tokens: mockTokens };
    }

    const response = await apiClient.post<LoginResponse>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    if (IS_DEV) {
      await delay(1000);
      console.log('Password reset requested for:', data.email);
      return;
    }

    await apiClient.post('/auth/password-reset/request', data);
  },

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    if (IS_DEV) {
      await delay(1000);
      console.log('Password reset confirmed with token:', token);
      return;
    }

    await apiClient.post('/auth/password-reset/confirm', {
      token,
      newPassword,
    });
  },

  /**
   * Logout (invalidate tokens on server)
   */
  async logout(): Promise<void> {
    if (IS_DEV) {
      await delay(300);
      return;
    }

    await apiClient.post('/auth/logout');
  },

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    if (IS_DEV) {
      await delay(500);
      return mockUser;
    }

    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
