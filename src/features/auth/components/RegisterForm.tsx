import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useAuth } from '../hooks';

/**
 * Registration form validation schema
 * Based on auth-register-endpoint.md specification
 */
const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Ingresa un correo válido'),
  username: z
    .string()
    .min(1, 'El nombre de usuario es requerido')
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(100, 'El usuario no puede exceder 100 caracteres'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres'),
  first_name: z
    .string()
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
  last_name: z
    .string()
    .max(100, 'El apellido no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  /** Callback when registration is successful */
  onSuccess?: () => void;
}

/**
 * RegisterForm Component
 *
 * Features:
 * - Email, username, password validation with Zod
 * - Optional first name and last name fields
 * - Loading state with disabled form
 * - Error display (both field-level and API errors)
 */
export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register: registerUser, isLoading, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      first_name: '',
      last_name: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    try {
      await registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
        first_name: data.first_name || undefined,
        last_name: data.last_name || undefined,
      });
      onSuccess?.();
    } catch {
      // Error is already handled in the store
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      {/* Username field */}
      <Input
        label="Nombre de usuario"
        type="text"
        autoComplete="username"
        leftIcon={<User size={20} />}
        error={errors.username?.message}
        disabled={isLoading}
        {...register('username')}
      />

      {/* Password field */}
      <Input
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        leftIcon={<Lock size={20} />}
        error={errors.password?.message}
        disabled={isLoading}
        {...register('password')}
      />

      {/* Optional fields row */}
      <div className="grid grid-cols-2 gap-4">
        {/* First name field */}
        <Input
          label="Nombre (opcional)"
          type="text"
          autoComplete="given-name"
          error={errors.first_name?.message}
          disabled={isLoading}
          {...register('first_name')}
        />

        {/* Last name field */}
        <Input
          label="Apellido (opcional)"
          type="text"
          autoComplete="family-name"
          error={errors.last_name?.message}
          disabled={isLoading}
          {...register('last_name')}
        />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={isLoading}
        disabled={isLoading}
      >
        {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
      </Button>
    </form>
  );
}
