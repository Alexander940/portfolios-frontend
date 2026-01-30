import { Outlet } from 'react-router-dom';
import { Header } from '@/components/navigation';

/**
 * DashboardLayout Component
 *
 * Main layout wrapper for all dashboard pages.
 * Provides consistent header navigation and renders child routes via Outlet.
 */
export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
