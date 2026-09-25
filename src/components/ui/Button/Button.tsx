'use client';

import { cn } from '@/lib/utils';
import type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 disabled:bg-orange-300',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-[var(--t-surface-2)] dark:text-[var(--t-text-2)] dark:border dark:border-[var(--t-border)] dark:hover:bg-[var(--t-border)] dark:disabled:bg-[var(--t-surface)] dark:disabled:text-[var(--t-text-4)]',
  danger: 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 disabled:text-gray-300 dark:text-[var(--t-text-2)] dark:hover:bg-[var(--t-surface-2)] dark:disabled:text-[var(--t-text-4)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
