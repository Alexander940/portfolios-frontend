import { Screener } from '@/features/screener';

/**
 * ScreeningPage - Screen and filter stocks
 *
 * Full-featured stock screener with:
 * - Primary filters (Market, Sector, Rating)
 * - Additional configurable filters
 * - Sortable results table
 * - Pagination
 * - URL state sync for bookmarkable searches
 */
export function ScreeningPage() {
  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Screening</h1>
        <p className="text-gray-600 mt-1">
          Filter and find stocks based on your criteria.
        </p>
      </div>

      <Screener />
    </div>
  );
}
