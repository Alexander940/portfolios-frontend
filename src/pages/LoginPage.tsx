import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { LoginForm, RegisterModal, useModalStore } from '@/features/auth';
import { LoginArt } from './LoginArt';

/**
 * LoginPage
 *
 * Two-pane shell ported from the Cloud Design Prime variation:
 * - Left: animated dark gradient art panel (LoginArt)
 * - Right: brand + form + footer
 *
 * Hidden left panel under 980px (collapses to single-column form).
 */
export function LoginPage() {
  const { successMessage, clearSuccessMessage } = useModalStore();

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => clearSuccessMessage(), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccessMessage]);

  return (
    <div className="login-app">
      <div className="login-art-pane">
        <LoginArt />
      </div>

      <div className="login-form-pane">
        <div className="login-form-wrap">
          <div className="login-brand">
            <div className="brand-mark">P</div>
            <span className="brand-name">Portafolios</span>
          </div>

          <div className="login-form">
            <h2 className="login-title">Bienvenido de nuevo</h2>
            <div className="login-sub">
              Ingresa tus credenciales para continuar a tus portafolios.
            </div>

            {successMessage && (
              <div className="login-alert success" role="alert">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1 }}>{successMessage}</span>
                <button
                  type="button"
                  onClick={clearSuccessMessage}
                  aria-label="Cerrar mensaje"
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <LoginForm />
          </div>

          <div className="login-legal">
            <div>© {new Date().getFullYear()} Portafolios</div>
            <div className="login-legal-links">
              <button type="button" className="login-link">
                Privacidad
              </button>
              <button type="button" className="login-link">
                Términos
              </button>
            </div>
          </div>
        </div>
      </div>

      <RegisterModal />
    </div>
  );
}
