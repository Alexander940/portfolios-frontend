import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages';
import { DashboardLayout } from '@/layouts';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

// Lazy load dashboard pages for better performance
const OverviewPage = lazy(() =>
  import('@/pages/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const AlertsPage = lazy(() =>
  import('@/pages/dashboard/AlertsPage').then((m) => ({ default: m.AlertsPage }))
);
const StrategyTrackerPage = lazy(() =>
  import('@/pages/dashboard/StrategyTrackerPage').then((m) => ({ default: m.StrategyTrackerPage }))
);
const MarketsPage = lazy(() =>
  import('@/pages/dashboard/MarketsPage').then((m) => ({ default: m.MarketsPage }))
);
const ScreeningPage = lazy(() =>
  import('@/pages/dashboard/ScreeningPage').then((m) => ({ default: m.ScreeningPage }))
);
const PortfolioAnalysisPage = lazy(() =>
  import('@/pages/dashboard/PortfolioAnalysisPage').then((m) => ({ default: m.PortfolioAnalysisPage }))
);
const RankPage = lazy(() =>
  import('@/pages/dashboard/RankPage').then((m) => ({ default: m.RankPage }))
);
const StrategyBuilderPage = lazy(() =>
  import('@/pages/dashboard/StrategyBuilderPage').then((m) => ({ default: m.StrategyBuilderPage }))
);

/**
 * Loading fallback component for lazy-loaded pages
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
    </div>
  );
}

/**
 * Wrap lazy component with Suspense
 */
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

/**
 * Application router configuration
 *
 * Route structure:
 * - /login - Public login page
 * - /dashboard - Protected dashboard with nested routes
 *   - /dashboard (index) - Overview page
 *   - /dashboard/alerts - Alerts management
 *   - /dashboard/strategy - Strategy tracker
 *   - /dashboard/markets - Market data
 *   - /dashboard/screening - Asset screening
 *   - /dashboard/analysis - Portfolio analysis
 *   - /dashboard/rank - Asset rankings
 *   - /dashboard/builder - Strategy builder
 *   - /dashboard/reports - Reports hub
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
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
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: withSuspense(OverviewPage),
      },
      {
        path: 'alerts',
        element: withSuspense(AlertsPage),
      },
      {
        path: 'strategy',
        element: withSuspense(StrategyTrackerPage),
      },
      {
        path: 'markets',
        element: withSuspense(MarketsPage),
      },
      {
        path: 'screening',
        element: withSuspense(ScreeningPage),
      },
      {
        path: 'analysis',
        element: withSuspense(PortfolioAnalysisPage),
      },
      {
        path: 'rank',
        element: withSuspense(RankPage),
      },
      {
        path: 'builder',
        element: withSuspense(StrategyBuilderPage),
      },
    ],
  },
  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
