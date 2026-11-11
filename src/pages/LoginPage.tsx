import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { LoginForm, RegisterModal, useModalStore } from '@/features/auth';
import { LoginArt } from './LoginArt';

/**
 * LoginPage
 *
 * Two-pane shell:
 * - Left: product panel (LoginArt) — hidden under 980px
 * - Right: brand (only under 980px) + form + footer
 *
 * No links without a destination: password recovery and legal pages do
 * not exist yet, so they are not shown (#34).
 */
export function LoginPage() {
  const { successMessage, clearSuccessMessage } = useModalStore();

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => clearSuccessMessage(), 8000);
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
            <div className="brand-mark" aria-hidden="true">
              P
            </div>
            <span className="brand-name">Portafolios</span>
          </div>

          <div className="login-form">
            <h2 className="login-title">Sign in</h2>
            <div className="login-sub">
              Enter your email and password to see your portfolios.
            </div>

            {successMessage && (
              <div className="login-alert success" role="status">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1 }}>{successMessage}</span>
                <button
                  type="button"
                  onClick={clearSuccessMessage}
                  aria-label="Dismiss message"
                  className="login-alert-dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <LoginForm />
          </div>

          <div className="login-legal">
            <div>© {new Date().getFullYear()} Portafolios</div>
            <div>Private use · access by invitation</div>
          </div>
        </div>
      </div>

      <RegisterModal />
    </div>
  );
}
