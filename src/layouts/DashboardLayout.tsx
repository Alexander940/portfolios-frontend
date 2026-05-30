import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, Topbar } from '@/components/navigation';
import { RelevantEventsRail } from '@/features/portfolio';

/**
 * DashboardLayout
 *
 * App shell with persistent left sidebar, topbar, and main content area.
 * The right-side "Relevant Events" rail is shown only on the Portfolio
 * Analysis list view.
 */
export function DashboardLayout() {
  const { pathname } = useLocation();
  const showRail = pathname === '/dashboard/analysis';
  // Full-bleed pages manage their own height/scroll (no padded content
  // wrapper) — the assistant fills the shell with its own scroll + composer.
  const fullBleed = pathname === '/dashboard/assistant';

  return (
    <div className="app-shell">
      <Sidebar />
      <Topbar />
      <div className={`app-main ${showRail ? 'has-rail' : ''}`}>
        {fullBleed ? (
          <Outlet />
        ) : (
          <div className="app-main-content">
            <Outlet />
          </div>
        )}
        {showRail && (
          <aside className="app-main-rail" aria-label="Relevant events">
            <RelevantEventsRail />
          </aside>
        )}
      </div>
    </div>
  );
}
