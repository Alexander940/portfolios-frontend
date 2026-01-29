import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import type { LoginCredentials } from '../types';

/**
 * Custom hook for authentication operations
 *
 * Provides a clean interface to auth operations with navigation handling.
 * Wraps the auth store and adds common patterns like redirect after login/logout.
 */
export function useAuth() {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    clearError,
  } = useAuthStore();

  /**
   * Login and redirect to dashboard on success
   */
  const login = useCallback(
    async (credentials: LoginCredentials, redirectTo = '/dashboard') => {
      try {
        await storeLogin(credentials);
        navigate(redirectTo);
      } catch {
        // Error is already set in the store
      }
    },
    [storeLogin, navigate]
  );

  /**
   * Logout and redirect to login page
   */
  const logout = useCallback(() => {
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };
}
