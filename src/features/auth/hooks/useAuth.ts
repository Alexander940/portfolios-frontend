import { useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores';
import type { LoginCredentials, RegisterData } from '../types';

/**
 * Custom hook for authentication operations
 *
 * Provides a clean interface to auth operations with:
 * - Navigation handling after login/logout
 * - Redirect to intended destination after login
 * - App initialization (restore session from storage)
 */
export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login: storeLogin,
    register: storeRegister,
    logout: storeLogout,
    clearError,
    initialize,
  } = useAuthStore();

  /**
   * Initialize auth on mount
   * Checks for existing token and restores session if valid
   */
  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Login and redirect to dashboard (or intended destination)
   */
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        await storeLogin(credentials);

        // Redirect to the page they were trying to access, or dashboard
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } catch {
        // Error is already set in the store
      }
    },
    [storeLogin, navigate, location.state]
  );

  /**
   * Register a new account
   * On success, redirects to login page with success message
   */
  const register = useCallback(
    async (data: RegisterData) => {
      try {
        await storeRegister(data);
        // Redirect to login page after successful registration
        navigate('/login', {
          state: { message: 'Cuenta creada exitosamente. Por favor inicia sesión.' },
        });
      } catch {
        // Error is already set in the store
      }
    },
    [storeRegister, navigate]
  );

  /**
   * Logout and redirect to login page
   */
  const logout = useCallback(() => {
    storeLogout();
    navigate('/login', { replace: true });
  }, [storeLogout, navigate]);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,

    // Actions
    login,
    register,
    logout,
    clearError,
  };
}
