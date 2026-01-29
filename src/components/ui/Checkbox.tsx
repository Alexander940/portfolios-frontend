import { type InputHTMLAttributes, forwardRef } from 'react';
import { Check } from 'lucide-react';

/**
 * Custom Checkbox component with accessible label
 */

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-center cursor-pointer select-none ${className}`}
      >
        <div className="relative">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <div
            className={`
              w-5 h-5
              border-2 rounded
              transition-colors duration-200
              peer-checked:bg-[#1e3a5f] peer-checked:border-[#1e3a5f]
              peer-focus:ring-2 peer-focus:ring-[#1e3a5f] peer-focus:ring-offset-2
              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
              border-gray-300
            `}
          />
          <Check
            size={14}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
          />
        </div>
        <span className="ml-2 text-sm text-gray-700">{label}</span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
