import type { ReactNode } from 'react';

export interface CashPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export interface CashCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export type CashNoticeTone = 'info' | 'warning' | 'danger' | 'success';

export interface CashNoticeProps {
  tone?: CashNoticeTone;
  title?: string;
  children?: ReactNode;
}
