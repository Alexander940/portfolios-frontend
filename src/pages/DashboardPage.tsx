import { LogOut, TrendingUp, Wallet, PieChart, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth';

/**
 * Dashboard Page (Placeholder)
 *
 * Temporary dashboard with logout functionality.
 * Will be fully implemented in future iterations.
 */
export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1e3a5f] rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#c9a227]" />
              </div>
              <span className="text-xl font-bold text-[#1e3a5f]">
                PortfolioHub
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Hola, <span className="font-medium">{user?.username}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                rightIcon={<LogOut size={16} />}
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido de nuevo, {user?.username}
          </h1>
          <p className="text-gray-600 mt-1">
            Aquí está el resumen de tu portafolio de inversiones.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Valor Total</p>
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
                <p className="text-sm text-gray-500">Activos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">24</p>
                <p className="text-sm text-gray-500 mt-1">En 5 categorías</p>
              </div>
              <div className="w-12 h-12 bg-[#c9a227]/10 rounded-full flex items-center justify-center">
                <PieChart className="w-6 h-6 text-[#c9a227]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Rendimiento Mensual</p>
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
            Panel en construcción
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Estamos trabajando en tu panel de control personalizado. Pronto
            podrás ver gráficos detallados, análisis de rendimiento y más.
          </p>
        </div>
      </main>
    </div>
  );
}
