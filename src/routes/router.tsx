import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage, DashboardPage } from '@/pages';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

/**
 * Application router configuration
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
