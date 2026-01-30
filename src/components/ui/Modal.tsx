import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks';

/**
 * Modal size variants
 */
const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal title - displayed in header and used for aria-labelledby */
  title: string;
  /** Optional description - displayed below title */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Modal size variant */
  size?: keyof typeof sizeStyles;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
}

/**
 * Modal Component
 *
 * A reusable, accessible modal dialog with:
 * - Portal rendering to document.body
 * - Focus trapping for keyboard navigation
 * - Escape key to close
 * - Backdrop click to close
 * - Body scroll lock
 * - CSS animations for enter/exit
 * - Full ARIA support
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const titleId = `modal-title-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const descriptionId = description
    ? `modal-description-${title.toLowerCase().replace(/\s+/g, '-')}`
    : undefined;

  // Handle focus trapping
  useFocusTrap(modalRef, isOpen);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      // Opening: render first, then animate in
      setIsVisible(true);
      // Use requestAnimationFrame to ensure the element is rendered before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      // Closing: animate out first, then unmount
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  // Don't render anything if not visible
  if (!isVisible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 backdrop-blur-sm
          transition-opacity duration-200
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Modal panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`
          relative z-10 w-full ${sizeStyles[size]}
          bg-white rounded-2xl shadow-2xl
          transform transition-all duration-200
          ${isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2
              id={titleId}
              className="text-xl font-semibold text-gray-900"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-gray-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="
              p-2 rounded-lg text-gray-400
              hover:text-gray-600 hover:bg-gray-100
              focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-2
              transition-colors
            "
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
