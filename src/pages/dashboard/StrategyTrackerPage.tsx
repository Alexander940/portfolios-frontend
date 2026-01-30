import { Target } from 'lucide-react';

/**
 * StrategyTrackerPage - Track trading strategies
 */
export function StrategyTrackerPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Strategy Tracker</h1>
        <p className="text-gray-600 mt-1">
          Monitorea el rendimiento de tus estrategias de trading.
        </p>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Strategy Tracker - En construcción
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Pronto podrás rastrear y analizar el desempeño de tus estrategias.
        </p>
      </div>
    </div>
  );
}
