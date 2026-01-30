import { Filter } from 'lucide-react';

/**
 * ScreeningPage - Screen and filter assets
 */
export function ScreeningPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Screening</h1>
        <p className="text-gray-600 mt-1">
          Filtra y encuentra activos según tus criterios.
        </p>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Filter className="w-8 h-8 text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Screening - En construcción
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Pronto podrás filtrar activos con criterios personalizados.
        </p>
      </div>
    </div>
  );
}
