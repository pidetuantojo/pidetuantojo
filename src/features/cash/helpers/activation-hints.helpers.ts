export type ActivationAction = 'ledger' | 'register' | 'settings';

export interface ActivationHint {
  hint: string;
  action: ActivationAction;
}

/**
 * Pista para resolver cada requisito faltante. Los textos vienen del servidor
 * (`computeActivationMissing`); se reconocen por su contenido y, si no se reconoce, se manda a
 * los ajustes.
 */
export function activationHint(item: string): ActivationHint {
  const text = item.toLowerCase();
  if (text.includes('plan de cuentas')) {
    return {
      hint: 'Siembra las cuentas y reglas contables estándar con un clic.',
      action: 'ledger',
    };
  }
  if (text.includes('crear al menos una caja general')) {
    return { hint: 'Creá una caja de tipo General en la sección Cajas.', action: 'register' };
  }
  return { hint: 'Completalo en la sección Ajustes de caja.', action: 'settings' };
}
