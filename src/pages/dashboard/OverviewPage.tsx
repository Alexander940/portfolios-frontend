import { Wallet, PieChart, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/features/auth';

/**
 * OverviewPage - Dashboard main page
 *
 * Shows portfolio summary, quick stats, and overview information.
 */
export function OverviewPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.username}
        </h1>
        <p className="text-gray-600 mt-1">
          Here's a snapshot of your investment portfolio.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                $125,432.00
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <ArrowUpRight size={14} />
                +12.5%
              </p>
            </div>
            <div className="w-12 h-12 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-[#1e3a5f]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Holdings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">24</p>
              <p className="text-sm text-gray-500 mt-1">Across 5 sectors</p>
            </div>
            <div className="w-12 h-12 bg-[#c9a227]/10 rounded-full flex items-center justify-center">
              <PieChart className="w-6 h-6 text-[#c9a227]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Monthly return</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                +$2,845.00
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <ArrowUpRight size={14} />
                +3.2%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PieChart className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Dashboard under construction
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          We're building your personalized control panel. Detailed charts,
          performance analytics and more are coming soon.
        </p>
      </div>
    </div>
  );
}
