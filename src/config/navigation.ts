import {
  Bell,
  Target,
  TrendingUp,
  Filter,
  PieChart,
  Award,
  Blocks,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { path: '/dashboard/analysis', label: 'Portfolios', icon: PieChart },
      { path: '/dashboard/strategy', label: 'Strategy Tracker', icon: Target },
      { path: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    label: 'Research',
    items: [
      { path: '/dashboard/markets', label: 'Markets', icon: TrendingUp },
      { path: '/dashboard/screening', label: 'Screener', icon: Filter },
      { path: '/dashboard/builder', label: 'Strategy Builder', icon: Blocks },
      { path: '/dashboard/rank', label: 'Rank', icon: Award },
    ],
  },
];

/**
 * Flat list of all nav items, kept for any consumer that still needs it.
 */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
