import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute Component
 *
 * Wraps routes that should only be accessible to non-authenticated users
 * (like login, register). Redirects to dashboard if already logged in.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
