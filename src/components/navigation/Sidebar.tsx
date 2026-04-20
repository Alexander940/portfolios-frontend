import { NavLink } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { NAV_SECTIONS } from '@/config/navigation';

/**
 * Sidebar — persistent left navigation.
 *
 * Sections: Workspace, Research, Watchlist (empty until backend exposes it).
 */
export function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark">
          <TrendingUp size={16} strokeWidth={2.25} />
        </div>
        <span className="brand-name">Portafolios</span>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="nav-section">
          <div className="nav-label">{section.label}</div>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={false}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={14} strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}

      <div className="nav-section">
        <div className="nav-label">Watchlist</div>
        <div className="nav-empty">No items yet</div>
      </div>
    </aside>
  );
}
