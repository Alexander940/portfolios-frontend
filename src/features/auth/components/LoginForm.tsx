import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Input, Checkbox } from '@/components/ui';
import { useAuth } from '../hooks';

/**
 * Login form validation schema
 */
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
 * LoginForm Component
 *
 * Features:
 * - Email/password validation with Zod
 * - "Remember me" checkbox
 * - Loading state with disabled form
 * - Error display
 * - Link to password recovery
 */
export function LoginForm() {
  const { login, isLoading, error, clearError } = useAuth();

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Global error message */}
      {error && (
        <div
          className="flex items-center gap-2 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Email field */}
      <Input
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        leftIcon={<Mail size={20} />}
        error={errors.email?.message}
        disabled={isLoading}
        {...register('email')}
      />

      {/* Password field */}
      <Input
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        leftIcon={<Lock size={20} />}
        error={errors.password?.message}
        disabled={isLoading}
        {...register('password')}
      />

      {/* Remember me & Forgot password */}
      <div className="flex items-center justify-between">
        <Checkbox
          label="Recordarme"
          disabled={isLoading}
          {...register('rememberMe')}
        />

        <Link
          to="/forgot-password"
          className="text-sm font-medium text-[#1e3a5f] hover:text-[#2d5a8a] transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={isLoading}
        disabled={isLoading}
      >
        {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </Button>

      {/* Sign up link */}
      <p className="text-center text-sm text-gray-600">
        ¿No tienes una cuenta?{' '}
        <Link
          to="/register"
          className="font-medium text-[#1e3a5f] hover:text-[#2d5a8a] transition-colors"
        >
          Regístrate aquí
        </Link>
      </p>
    </form>
  );
}
