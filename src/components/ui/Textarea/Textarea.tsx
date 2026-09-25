import { cn } from '@/lib/utils';
import type { TextareaProps } from './Textarea.types';

export function Textarea({ label, error, hint, className, id, rows = 3, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-[var(--t-text-2)]">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors resize-none',
          'dark:text-[var(--t-text-1)] dark:placeholder-[var(--t-text-4)]',
          'border-gray-300 bg-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
          'dark:border-[var(--t-input-border)] dark:bg-[var(--t-input-bg)]',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          props.disabled && 'cursor-not-allowed bg-gray-50 text-gray-500 dark:bg-[var(--t-surface-2)] dark:text-[var(--t-text-3)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500 dark:text-[var(--t-text-3)]">{hint}</p>}
    </div>
  );
}
