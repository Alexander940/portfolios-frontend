import { Award } from 'lucide-react';

/**
 * RankPage - Asset rankings and comparisons
 */
export function RankPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rank</h1>
        <p className="text-gray-600 mt-1">Asset rankings and comparisons.</p>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-[#c9a227]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-[#c9a227]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Rank — Under construction
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Asset rankings and comparisons are coming soon.
        </p>
      </div>
    </div>
  );
}
