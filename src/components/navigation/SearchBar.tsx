import { Search } from 'lucide-react';

/**
 * SearchBar Component
 *
 * Global search input for the dashboard header.
 * Currently visual-only; search functionality to be implemented later.
 */
export function SearchBar() {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={18}
      />
      <input
        type="text"
        placeholder="Buscar..."
        className="
          w-64 pl-10 pr-4 py-2
          bg-gray-100 border border-transparent rounded-lg
          text-sm text-gray-900 placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent focus:bg-white
          transition-colors duration-200
        "
      />
    </div>
  );
}
