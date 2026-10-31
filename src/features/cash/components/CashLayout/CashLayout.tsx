import { cn } from '@/lib/utils';

import type {
  CashCardProps,
  CashNoticeProps,
  CashNoticeTone,
  CashPageHeaderProps,
} from './CashLayout.types';

export function CashPageHeader({ title, description, actions }: CashPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--t-text-1)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--t-text-3)' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CashCard({ title, description, actions, children, className }: CashCardProps) {
  return (
    <section
      className={cn('rounded-2xl p-5', className)}
      style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)' }}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && (
              <h3 className="text-base font-bold" style={{ color: 'var(--t-text-1)' }}>
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-text-3)' }}>
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const NOTICE_CLASSES: Record<CashNoticeTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
};

export function CashNotice({ tone = 'info', title, children }: CashNoticeProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', NOTICE_CLASSES[tone])}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
    </div>
  );
}
