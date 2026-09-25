import type { PaymentMethodType } from '@/types';

export interface PaymentMethodDefinition {
  type: PaymentMethodType;
  label: string;
  // true = cuenta para transferir (se pueden cargar varias)
  isTransfer: boolean;
  accountLabel?: string;
  accountPlaceholder?: string;
}

export const PAYMENT_METHOD_DEFINITIONS: Record<PaymentMethodType, PaymentMethodDefinition> = {
  efectivo: { type: 'efectivo', label: 'Efectivo', isTransfer: false },
  datafono: { type: 'datafono', label: 'Datáfono', isTransfer: false },
  nequi: {
    type: 'nequi', label: 'Nequi', isTransfer: true,
    accountLabel: 'Número de celular', accountPlaceholder: '3001234567',
  },
  daviplata: {
    type: 'daviplata', label: 'Daviplata', isTransfer: true,
    accountLabel: 'Número de celular', accountPlaceholder: '3001234567',
  },
  breb: {
    type: 'breb', label: 'BreB', isTransfer: true,
    accountLabel: 'Llave (alias o número)', accountPlaceholder: '@turestaurante',
  },
  bancolombia: {
    type: 'bancolombia', label: 'Bancolombia', isTransfer: true,
    accountLabel: 'Número de cuenta', accountPlaceholder: '12345678901',
  },
  otro_banco: {
    type: 'otro_banco', label: 'Otro banco', isTransfer: true,
    accountLabel: 'Número de cuenta', accountPlaceholder: '123456789',
  },
};

// Pago al recibir / en el local: uno por tipo, sin datos
export const IN_PERSON_TYPES: PaymentMethodType[] = ['efectivo', 'datafono'];

// Cuentas para transferir: se pueden agregar varias
export const TRANSFER_TYPES: PaymentMethodType[] = ['nequi', 'daviplata', 'breb', 'bancolombia', 'otro_banco'];
