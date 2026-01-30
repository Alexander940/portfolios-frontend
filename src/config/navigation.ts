import {
  Bell,
  Target,
  TrendingUp,
  Filter,
  PieChart,
  Award,
  Blocks,
  FileText,
  type LucideIcon,
} from 'lucide-react';

/**
 * Navigation item configuration
 */
export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Main navigation items for the dashboard
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { path: '/dashboard/strategy', label: 'Strategy Tracker', icon: Target },
  { path: '/dashboard/markets', label: 'Markets', icon: TrendingUp },
  { path: '/dashboard/screening', label: 'Screening', icon: Filter },
  { path: '/dashboard/analysis', label: 'Portfolio Analysis', icon: PieChart },
  { path: '/dashboard/rank', label: 'Rank', icon: Award },
  { path: '/dashboard/builder', label: 'Strategy Builder', icon: Blocks },
  { path: '/dashboard/reports', label: 'Reports Hub', icon: FileText },
];
