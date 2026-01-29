import { apiClient } from '@/lib/axios';
import type {
  LoginCredentials,
  LoginApiResponse,
  RegisterData,
  RegisterApiResponse,
  CurrentUserResponse,
} from '../types';

/**
 * Authentication API Service
 *
 * Handles all authentication-related API calls.
 * Based on auth-api.md documentation.
 *
 * Endpoints:
 * - POST /auth/register - Register new user (JSON)
 * - POST /auth/login - Login (form-urlencoded, OAuth2 flow)
 * - GET /auth/me - Get current user (requires auth)
 */

export const authService = {
  /**
   * Authenticate user with email and password
   *
   * POST /auth/login
   * Content-Type: application/x-www-form-urlencoded
   *
   * Note: The API expects 'username' field but actually uses email.
   * This is standard OAuth2 password flow behavior.
   *
   * @param credentials - User email and password
   * @returns Access token and token type
   */
  async login(credentials: LoginCredentials): Promise<LoginApiResponse> {
    // API uses OAuth2 password flow with form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', credentials.email); // API expects email in 'username' field
    formData.append('password', credentials.password);

    const response = await apiClient.post<LoginApiResponse>(
      '/auth/login',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  },

  /**
   * Register a new user account
   *
   * POST /auth/register
   * Content-Type: application/json
   *
   * @param data - Registration data (username, email, password)
   * @returns Created user info (without password)
   */
  async register(data: RegisterData): Promise<RegisterApiResponse> {
    const response = await apiClient.post<RegisterApiResponse>(
      '/auth/register',
      data
    );

    return response.data;
  },

  /**
   * Get the currently authenticated user's information
   *
   * GET /auth/me
   * Requires: Authorization: Bearer <token>
   *
   * @returns Current user info
   */
  async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me');
    return response.data;
  },
};
