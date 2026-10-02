import type { FeaturePermission } from '@/constants/permissions';
import type { PaymentMethodConfig, Restaurant } from '@/types';

/**
 * Funcionalidades del plan en el menú público (sin sesión).
 * El servidor copia `features.*` del plan en `restaurant.planFeatures`; si no existe,
 * el restaurante es anterior al sistema de planes y tiene todo habilitado.
 */
export function hasPlanFeature(
  restaurant: Pick<Restaurant, 'planFeatures'>,
  feature: FeaturePermission
): boolean {
  if (!restaurant.planFeatures) return true;
  return restaurant.planFeatures.includes(feature);
}

const CASH_ONLY: PaymentMethodConfig[] = [{ id: 'efectivo', type: 'efectivo', isActive: true }];

/**
 * Devuelve el restaurante con la configuración que su plan no incluye apagada,
 * para que el menú público no ofrezca opciones que el restaurante no contrató.
 * No modifica el objeto original.
 */
export function applyPlanFeatures<T extends Restaurant>(restaurant: T): T {
  if (!restaurant.planFeatures) return restaurant;
  const has = (feature: FeaturePermission) => hasPlanFeature(restaurant, feature);
  const next: T = { ...restaurant };

  if (!has('features.scheduled_orders')) {
    next.allowScheduledWhenClosed = false;
    if (next.deliveryMethods) {
      const { recoger, domicilio } = next.deliveryMethods;
      next.deliveryMethods = {
        ...next.deliveryMethods,
        ...(recoger ? { recoger: { ...recoger, allowScheduled: false } } : {}),
        ...(domicilio ? { domicilio: { ...domicilio, allowScheduled: false } } : {}),
      };
    }
  }

  if (!has('features.dine_in') && next.deliveryMethods?.mesa) {
    next.deliveryMethods = { ...next.deliveryMethods, mesa: { isActive: false } };
  }

  if (!has('features.delivery_zones') && next.deliveryMode === 'zones') {
    next.deliveryMode = 'manual';
  }

  if (!has('features.payment_accounts') && next.paymentMethods) {
    // Solo efectivo: sin datáfono ni cuentas de transferencia
    const cash = next.paymentMethods.filter((m) => m.type === 'efectivo' && m.isActive);
    next.paymentMethods = cash.length > 0 ? cash : CASH_ONLY;
  }

  // Sin promociones avanzadas no hay programa de fidelidad
  if (!has('features.promotions_advanced') && next.loyalty) {
    next.loyalty = undefined;
  }

  return next;
}
