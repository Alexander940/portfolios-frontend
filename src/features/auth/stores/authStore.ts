import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthStore, LoginCredentials } from '../types';
import { authService } from '../services/authService';
import { configureAxiosAuth } from '@/lib/axios';

/**
 * Authentication store using Zustand
 *
 * Features:
 * - Persistent storage for "remember me" functionality
 * - Token management
 * - Auto-refresh handling
 * - Logout clears all state
 */

const STORAGE_KEY = 'auth-storage';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(credentials);

          set({
            user: response.user,
            accessToken: response.tokens.accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Store refresh token securely (in a real app, this would be httpOnly cookie)
          if (credentials.rememberMe) {
            localStorage.setItem('refreshToken', response.tokens.refreshToken);
          } else {
            sessionStorage.setItem('refreshToken', response.tokens.refreshToken);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
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

      logout: () => {
        // Clear all auth data
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem(STORAGE_KEY);

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      refreshToken: async () => {
        const refreshToken =
          localStorage.getItem('refreshToken') ||
          sessionStorage.getItem('refreshToken');

        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const response = await authService.refreshToken(refreshToken);

          set({
            accessToken: response.tokens.accessToken,
            user: response.user,
            isAuthenticated: true,
          });

          // Update refresh token
          if (localStorage.getItem('refreshToken')) {
            localStorage.setItem('refreshToken', response.tokens.refreshToken);
          } else {
            sessionStorage.setItem('refreshToken', response.tokens.refreshToken);
          }
        } catch {
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setUser: (user) => {
        set({ user });
      },

      checkAuth: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          const storedRefreshToken =
            localStorage.getItem('refreshToken') ||
            sessionStorage.getItem('refreshToken');

          if (storedRefreshToken) {
            await get().refreshToken();
          }
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Configure axios with auth callbacks
configureAxiosAuth({
  getToken: () => useAuthStore.getState().accessToken,
  refreshToken: async () => {
    try {
      await useAuthStore.getState().refreshToken();
      return !!useAuthStore.getState().accessToken;
    } catch {
      return false;
    }
  },
  onAuthError: () => useAuthStore.getState().logout(),
});
