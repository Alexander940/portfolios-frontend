import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Clock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { isAccountNotActivatedError } from '@/lib/apiErrors';
import { useAuth } from '../hooks';
import { useModalStore } from '../stores/modalStore';

/**
 * Login only checks presence. The password policy (length, etc.) lives in
 * the registration form; enforcing it here would reject valid legacy
 * passwords and leak the policy (#34).
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * LoginForm — email + password with a keyboard-reachable password toggle.
 *
 * Distinguishes two server answers that used to share one red box:
 * - wrong credentials → `role="alert"` (red)
 * - account created but not yet activated by an admin → `role="status"` (amber)
 */
export function LoginForm() {
  const { login, isLoading, error, clearError } = useAuth();
  const { openModal } = useModalStore();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    await login({
      email: data.email,
      password: data.password,
      rememberMe: data.rememberMe,
    });
  };

  const isPending = isAccountNotActivatedError(error);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {error && isPending && (
        <div className="login-alert pending" role="status">
          <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {error && !isPending && (
        <div className="login-alert error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="login-fields">
        <div className="login-field">
          <div className="login-field-head">
            <label htmlFor="login-email">Email</label>
          </div>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            disabled={isLoading}
            className="login-input"
            placeholder="you@email.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <div id="login-email-error" className="login-field-error">
              {errors.email.message}
            </div>
          )}
        </div>

        <div className="login-field">
          <div className="login-field-head">
            <label htmlFor="login-password">Password</label>
          </div>
          <div className="login-pass">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isLoading}
              placeholder="Your password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? 'login-password-error' : undefined
              }
              {...register('password')}
            />
            <button
              type="button"
              className="login-pass-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <div id="login-password-error" className="login-field-error">
              {errors.password.message}
            </div>
          )}
        </div>

        <label className="login-check">
          <input
            type="checkbox"
            disabled={isLoading}
            {...register('rememberMe')}
          />
          <span>Keep me signed in on this device</span>
        </label>

        <button
          type="submit"
          className="login-cta"
          disabled={isLoading}
          aria-busy={isLoading || undefined}
        >
          {isLoading ? (
            <>
              <Loader2
                size={16}
                style={{ animation: 'spin 0.9s linear infinite' }}
              />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </div>

      <div className="login-foot">
        Don't have an account yet?{' '}
        <button
          type="button"
          className="login-link"
          onClick={() => openModal('register')}
        >
          Create account
        </button>
      </div>
      <div className="login-note">
        New accounts are activated by an administrator before first access.
      </div>
    </form>
  );
}
