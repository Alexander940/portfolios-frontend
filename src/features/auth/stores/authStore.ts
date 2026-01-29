import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthStore, LoginCredentials, RegisterData } from '../types';
import { authService } from '../services/authService';
import { configureAxiosAuth } from '@/lib/axios';
import { isApiError } from '@/lib/apiErrors';

/**
 * Authentication store using Zustand
 *
 * Features:
 * - Persistent storage for "remember me" functionality
 * - Token management (localStorage or sessionStorage)
 * - Automatic axios configuration
 * - Initialization check for app startup
 *
 * Storage Strategy:
 * - If "Remember Me" is checked: token in localStorage (persists across sessions)
 * - If "Remember Me" is unchecked: token in sessionStorage (cleared on browser close)
 */

const STORAGE_KEY = 'auth-storage';
const TOKEN_STORAGE_KEY = 'access_token';

/**
 * Get the appropriate storage based on where the token was saved
 */
function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
}

/**
 * Save token to the appropriate storage
 */
function saveTokenToStorage(token: string, rememberMe: boolean): void {
  if (rememberMe) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Clear token from all storages
 */
function clearTokenFromStorage(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      /**
       * Login with email and password
       * On success: fetches user info and stores token
       */
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // 1. Get access token from login endpoint
          const loginResponse = await authService.login(credentials);
          const token = loginResponse.access_token;

          // 2. Store token based on "remember me" preference
          saveTokenToStorage(token, credentials.rememberMe ?? false);

          // 3. Update store with token (needed for getCurrentUser call)
          set({ accessToken: token });

          // 4. Fetch user profile
          const user = await authService.getCurrentUser();

          // 5. Update store with complete auth state
          set({
            user,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = isApiError(error)
            ? error.message
            : 'Error al iniciar sesión';

          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
            user: null,
            accessToken: null,
          });

          throw error;
        }
      },

      /**
       * Register a new user
       * Note: Registration doesn't auto-login, user must login separately
       */
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          await authService.register(data);
          set({ isLoading: false, error: null });
        } catch (error) {
          const message = isApiError(error)
            ? error.message
            : 'Error al registrar usuario';

          set({
            isLoading: false,
            error: message,
          });

          throw error;
        }
      },

      /**
       * Logout - clear all auth state and tokens
       */
      logout: () => {
        clearTokenFromStorage();

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      /**
       * Clear error message
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Manually set user (useful for profile updates)
       */
      setUser: (user) => {
        set({ user });
      },

      /**
       * Check if there's a valid stored token and restore session
       * Called when the app initializes
       */
      checkAuth: async () => {
        const token = getTokenFromStorage();

        if (!token) {
          set({ isInitialized: true });
          return;
        }

        set({ isLoading: true, accessToken: token });

        try {
          const user = await authService.getCurrentUser();

          set({
            user,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          // Token is invalid or expired
          clearTokenFromStorage();

          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
        }
      },

      /**
       * Initialize the auth store
       * Should be called once when the app starts
       */
      initialize: async () => {
        if (get().isInitialized) {
          return;
        }

        await get().checkAuth();
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not tokens (tokens are managed separately)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// =============================================================================
// Axios Configuration
// =============================================================================

/**
 * Configure axios with auth callbacks
 * This runs immediately when the store module is loaded
 */
configureAxiosAuth({
  getToken: () => useAuthStore.getState().accessToken || getTokenFromStorage(),
  onAuthError: () => useAuthStore.getState().logout(),
});
