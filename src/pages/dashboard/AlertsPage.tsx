import { Bell } from 'lucide-react';

/**
 * AlertsPage - Manage trading alerts
 */
export function AlertsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        <p className="text-gray-600 mt-1">
          Configure and manage your trading alerts.
        </p>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Alerts — Under construction
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Custom alerts for your holdings will be available soon.
        </p>
      </div>
    </div>
  );
}
