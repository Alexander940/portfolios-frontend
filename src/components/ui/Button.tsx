import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button component with multiple variants and loading state
 *
 * Variants:
 * - primary: Main action buttons (blue)
 * - secondary: Secondary actions (gray outline)
 * - ghost: Minimal styling
 * - danger: Destructive actions (red)
 *
 * Sizes: sm, md, lg
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1e3a5f] text-white hover:bg-[#2d5a8a] focus:ring-[#1e3a5f] disabled:bg-[#1e3a5f]/50',
  secondary:
    'bg-white text-[#1e3a5f] border border-[#1e3a5f] hover:bg-gray-50 focus:ring-[#1e3a5f] disabled:text-[#1e3a5f]/50',
  ghost:
    'bg-transparent text-[#1e3a5f] hover:bg-gray-100 focus:ring-[#1e3a5f] disabled:text-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}

        {children}

        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
