import { AtSign, Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentMethodType } from '@/types';

const ICONS: Record<PaymentMethodType, LucideIcon> = {
  efectivo: Banknote,
  datafono: CreditCard,
  nequi: Smartphone,
  daviplata: Smartphone,
  breb: AtSign,
  bancolombia: Landmark,
  otro_banco: Landmark,
};

interface PaymentMethodIconProps {
  type: PaymentMethodType;
  size?: number;
  color?: string;
}

export function PaymentMethodIcon({ type, size = 20, color }: PaymentMethodIconProps) {
  const Icon = ICONS[type];
  return <Icon size={size} color={color} aria-hidden="true" />;
}
