import type { PaymentMethodConfig, PaymentMethodType } from '@/types';

import { PAYMENT_METHOD_DEFINITIONS } from '../constants/payment-methods.constants';

// Si el restaurante nunca configuró pagos, se ofrece solo efectivo
export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'efectivo', type: 'efectivo', isActive: true },
];

const CELLPHONE_RE = /^3\d{9}$/;
const BREB_ALIAS_RE = /^@[a-zA-Z0-9._-]{3,30}$/;
const BREB_NUMBER_RE = /^\d{6,15}$/;
const BANCOLOMBIA_RE = /^\d{11}$/;
const BANK_ACCOUNT_RE = /^\d{6,20}$/;

export function getConfiguredPaymentMethods(methods?: PaymentMethodConfig[]): PaymentMethodConfig[] {
  return methods && methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
}

export function getActivePaymentMethods(methods?: PaymentMethodConfig[]): PaymentMethodConfig[] {
  return getConfiguredPaymentMethods(methods).filter((m) => m.isActive);
}

/** Quita espacios, guiones y puntos de los datos numéricos; el alias BreB solo se recorta. */
export function normalizeAccount(type: PaymentMethodType, account: string): string {
  const trimmed = account.trim();
  if (type === 'breb' && trimmed.startsWith('@')) return trimmed;
  return trimmed.replace(/[\s.-]/g, '');
}

/**
 * Devuelve un mensaje de error o null si los datos son válidos para el tipo.
 * La cuenta es opcional (el restaurante puede no querer mostrarla); si se ingresa, debe tener formato válido.
 */
export function validatePaymentAccount(
  type: PaymentMethodType,
  account: string,
  bankName = ''
): string | null {
  if (type === 'otro_banco' && bankName.trim().length < 2) return 'Ingresa el nombre del banco';

  const value = normalizeAccount(type, account);
  if (!value) return null;

  switch (type) {
    case 'efectivo':
    case 'datafono':
      return null;
    case 'nequi':
    case 'daviplata':
      return CELLPHONE_RE.test(value) ? null : 'Debe ser un celular de 10 dígitos que empiece por 3';
    case 'breb':
      return BREB_ALIAS_RE.test(value) || BREB_NUMBER_RE.test(value)
        ? null
        : 'Debe ser un alias que empiece con @ (ej: @turestaurante) o un número';
    case 'bancolombia':
      return BANCOLOMBIA_RE.test(value) ? null : 'La cuenta Bancolombia debe tener 11 dígitos';
    case 'otro_banco':
      return BANK_ACCOUNT_RE.test(value) ? null : 'El número de cuenta debe tener entre 6 y 20 dígitos';
  }
}

/** Nombre visible del método: "Nequi", "Davivienda" (otro banco), etc. */
export function getPaymentLabel(method: Pick<PaymentMethodConfig, 'type' | 'bankName'>): string {
  if (method.type === 'otro_banco' && method.bankName?.trim()) return method.bankName.trim();
  return PAYMENT_METHOD_DEFINITIONS[method.type].label;
}

/** Campos del pedido que describen el método elegido (sin `undefined`: Firestore los rechaza en setDoc). */
export function toOrderPayment(method: PaymentMethodConfig) {
  return {
    paymentMethod: getPaymentLabel(method),
    paymentMethodType: method.type,
    ...(method.account ? { paymentAccount: method.account } : {}),
  };
}

export function isTransferMethod(type: PaymentMethodType): boolean {
  return PAYMENT_METHOD_DEFINITIONS[type].isTransfer;
}

export function createPaymentMethodId(): string {
  return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
