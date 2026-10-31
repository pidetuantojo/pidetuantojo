// Bandera de módulo (solo cliente) que alimenta a `useCashModule`. Existe para que los servicios
// que escriben pagos directo en Firestore puedan negarse (defensa en profundidad: además las
// reglas de Firestore ya bloquean `payments`/`isPaid` cuando la caja está activa).
let enabled = false;

export function setCashModuleEnabled(value: boolean): void {
  enabled = value;
}

export function isCashModuleEnabled(): boolean {
  return enabled;
}

/** Los pagos por Firestore directo solo existen sin caja activa. */
export function assertLegacyPaymentsAllowed(): void {
  if (enabled) {
    throw new Error('La caja está activa: los pagos se registran desde la API de caja');
  }
}
