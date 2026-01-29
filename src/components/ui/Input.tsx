import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Input component with label, error state, and password visibility toggle
 *
 * Features:
 * - Floating label effect
 * - Error message display
 * - Password visibility toggle
 * - Left/right icons
 */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      type = 'text',
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            placeholder=" "
            className={`
              peer w-full
              px-4 py-3
              ${leftIcon ? 'pl-10' : ''}
              ${isPassword || rightIcon ? 'pr-10' : ''}
              border rounded-lg
              bg-white text-gray-900
              placeholder-transparent
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
              ${className}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />

          <label
            htmlFor={inputId}
            className={`
              absolute left-4
              ${leftIcon ? 'left-10' : ''}
              top-1/2 -translate-y-1/2
              text-gray-500
              transition-all duration-200
              pointer-events-none
              peer-placeholder-shown:text-base
              peer-focus:-top-0 peer-focus:text-xs peer-focus:bg-white peer-focus:px-1
              peer-[:not(:placeholder-shown)]:-top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-white peer-[:not(:placeholder-shown)]:px-1
              ${error ? 'text-red-500 peer-focus:text-red-500' : 'peer-focus:text-[#1e3a5f]'}
            `}
          >
            {label}
          </label>

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          )}

          {!isPassword && rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <div
            id={`${inputId}-error`}
            className="flex items-center mt-1.5 text-sm text-red-500"
            role="alert"
          >
            <AlertCircle size={16} className="mr-1 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
