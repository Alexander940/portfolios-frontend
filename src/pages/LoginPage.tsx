import { useEffect } from 'react';
import { TrendingUp, CheckCircle, X } from 'lucide-react';
import { LoginForm, RegisterModal, useModalStore } from '@/features/auth';

/**
 * LoginPage
 *
 * Full-page login screen with:
 * - Split layout: decorative left panel + form right panel
 * - Professional financial theme
 * - Responsive design (stacked on mobile)
 */
export function LoginPage() {
  const { successMessage, clearSuccessMessage } = useModalStore();

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        clearSuccessMessage();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccessMessage]);

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Decorative (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8a] to-[#152a45] relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl backdrop-blur-sm">
              <TrendingUp className="w-8 h-8 text-[#c9a227]" />
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
            Gestiona tus
            <br />
            <span className="text-[#c9a227]">inversiones</span>
            <br />
            con confianza
          </h1>

          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            Toma el control de tu portafolio de inversión. Analiza, planifica y
            optimiza tus activos en una plataforma segura y profesional.
          </p>

          {/* Stats or features */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div>
              <div className="text-3xl font-bold text-[#c9a227]">100%</div>
              <div className="text-sm text-white/60 mt-1">Seguro</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#c9a227]">24/7</div>
              <div className="text-sm text-white/60 mt-1">Disponible</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#c9a227]">Pro</div>
              <div className="text-sm text-white/60 mt-1">Herramientas</div>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#c9a227]/10 rounded-full blur-3xl" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo (visible only on small screens) */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-12 h-12 bg-[#1e3a5f] rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#c9a227]" />
              </div>
              <span className="text-2xl font-bold text-[#1e3a5f]">
                PortfolioHub
              </span>
            </div>
          </div>

          {/* Success message */}
          {successMessage && (
            <div
              className="mb-4 flex items-center justify-between gap-2 p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={clearSuccessMessage}
                className="p-1 rounded hover:bg-green-100 transition-colors"
                aria-label="Cerrar mensaje"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Card container */}
          <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Bienvenido de nuevo
              </h2>
              <p className="mt-2 text-gray-600">
                Ingresa tus credenciales para acceder
              </p>
            </div>

            {/* Login form */}
            <LoginForm />
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-8">
            © {new Date().getFullYear()} PortfolioHub. Todos los derechos
            reservados.
          </p>
        </div>
      </div>

      {/* Registration Modal */}
      <RegisterModal />
    </div>
  );
}
