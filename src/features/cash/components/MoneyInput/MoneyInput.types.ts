import type { Money } from '@/lib/shared/money';

export interface MoneyInputProps {
  /** Pesos enteros, o null si está vacío. */
  value: Money | null;
  onChange: (value: Money | null) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
}
