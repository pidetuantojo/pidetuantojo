// Prerrequisitos para activar el módulo de caja. Puro: decide qué falta con datos ya leídos.
import {
  getActivePaymentMethods,
  getPaymentLabel,
} from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { PaymentMethodConfig } from '@/types';

export interface ActivationFacts {
  hasLedgerAccounts: boolean;
  generalRegisterIds: readonly string[];
  defaultGeneralRegisterId?: string;
  paymentMethods?: PaymentMethodConfig[];
  paymentMethodAccounts: Record<string, string>;
}

/** Lista legible (en español) de lo que falta; vacía = se puede activar. */
export function computeActivationMissing(facts: ActivationFacts): string[] {
  const missing: string[] = [];
  if (!facts.hasLedgerAccounts) {
    missing.push('Configurar el plan de cuentas (libro contable)');
  }
  if (facts.generalRegisterIds.length === 0) {
    missing.push('Crear al menos una caja general');
  }
  if (
    !facts.defaultGeneralRegisterId ||
    !facts.generalRegisterIds.includes(facts.defaultGeneralRegisterId)
  ) {
    missing.push('Elegir la caja general por defecto en los ajustes de caja');
  }
  for (const method of getActivePaymentMethods(facts.paymentMethods)) {
    if (method.type === 'efectivo') continue;
    if (!facts.paymentMethodAccounts[method.id]) {
      missing.push(`Asignar la cuenta contable del medio de pago ${getPaymentLabel(method)}`);
    }
  }
  return missing;
}
