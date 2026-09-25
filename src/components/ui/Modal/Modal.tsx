'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ModalProps, ModalSize } from './Modal.types';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, description, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl dark:bg-[var(--t-surface)] dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)]',
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-gray-100 px-6 py-4 dark:border-[var(--t-border)]">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-[var(--t-text-1)]">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-[var(--t-text-3)]">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-[var(--t-text-3)] dark:hover:bg-[var(--t-surface-2)] dark:hover:text-[var(--t-text-1)]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
