import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks';
import { useModalStore } from '../stores/modalStore';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Ingresa un email válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * LoginForm — Cloud Design Prime styling, same auth logic as before.
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {error && (
        <div className="login-alert error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="login-fields">
        <div className="login-field">
          <div className="login-field-head">
            <label htmlFor="login-email">Correo electrónico</label>
          </div>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            disabled={isLoading}
            className="login-input"
            placeholder="tu@correo.com"
            {...register('email')}
          />
          {errors.email && (
            <div className="login-field-error">{errors.email.message}</div>
          )}
        </div>

        <div className="login-field">
          <div className="login-field-head">
            <label htmlFor="login-password">Contraseña</label>
            <button
              type="button"
              className="login-link"
              onClick={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              ¿Olvidaste?
            </button>
          </div>
          <div className="login-pass">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isLoading}
              placeholder="Tu contraseña"
              {...register('password')}
            />
            <button
              type="button"
              className="login-pass-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <div className="login-field-error">{errors.password.message}</div>
          )}
        </div>

        <label className="login-check">
          <input
            type="checkbox"
            disabled={isLoading}
            {...register('rememberMe')}
          />
          <span>Recordarme en este dispositivo</span>
        </label>

        <button
          type="submit"
          className="login-cta"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2
                size={16}
                style={{ animation: 'spin 0.9s linear infinite' }}
              />
              Iniciando sesión…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </div>

      <div className="login-foot">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          className="login-link"
          onClick={() => openModal('register')}
        >
          Regístrate →
        </button>
      </div>
    </form>
  );
}
