// Textos de promociones para el menú, el carrito, el panel, WhatsApp y el ticket.
import type { OrderDeliveryType, Promotion, PromotionType } from '@/types';

import { ineligibilityReason, unitDiscount, type PricingContext } from './engine';
import { formatMoney } from './money';

export { formatMoney };

export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = {
  item_discount: 'Producto en oferta',
  order_discount: 'Descuento en el total',
  free_delivery: 'Domicilio gratis',
  bundle: 'Lleva más, paga menos (2x1)',
  combo: 'Combo',
  gift: 'Regalo con la compra',
};

export const DELIVERY_TYPE_LABEL: Record<OrderDeliveryType, string> = {
  recoger: 'Recoger',
  domicilio: 'Domicilio',
  mesa: 'En el local',
};

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Etiqueta corta para el producto o la tarjeta: "-20%", "2x1", "Combo", "Envío gratis"… */
export function promotionBadge(p: Promotion): string {
  switch (p.type) {
    case 'item_discount':
      if (p.discountKind === 'percent') return `-${p.discountValue ?? 0}%`;
      if (p.discountKind === 'amount') return `-${formatMoney(p.discountValue ?? 0)}`;
      return 'Oferta';
    case 'order_discount':
      return p.discountKind === 'percent' ? `-${p.discountValue ?? 0}%` : `-${formatMoney(p.discountValue ?? 0)}`;
    case 'bundle':
      return `${p.buyQuantity ?? 2}x${p.payQuantity ?? 1}`;
    case 'combo':
      return 'Combo';
    case 'free_delivery':
      return 'Envío gratis';
    case 'gift':
      return 'Regalo';
  }
}

/** Resumen de una línea para el panel: "20% en Pizzas · desde $30.000 · Mar y Mié 15:00–18:00". */
export function describePromotion(
  p: Promotion,
  names: { products?: ReadonlyMap<string, string>; categories?: ReadonlyMap<string, string> } = {}
): string {
  const parts: string[] = [];
  const productName = (id: string) => names.products?.get(id) ?? 'producto';
  const targetText = () => {
    const t = p.target;
    if (!t || t.scope === 'all') return 'todo el menú';
    const ids = t.scope === 'categories' ? t.categoryIds ?? [] : t.productIds ?? [];
    const map = t.scope === 'categories' ? names.categories : names.products;
    const list = ids.map((id) => map?.get(id)).filter(Boolean) as string[];
    if (list.length === 0) return t.scope === 'categories' ? `${ids.length} categorías` : `${ids.length} productos`;
    return list.length > 3 ? `${list.slice(0, 3).join(', ')} y ${list.length - 3} más` : list.join(', ');
  };

  switch (p.type) {
    case 'item_discount':
      parts.push(p.discountKind === 'fixed_price'
        ? `${targetText()} a ${formatMoney(p.discountValue ?? 0)}`
        : `${promotionBadge(p).replace('-', '')} de descuento en ${targetText()}`);
      break;
    case 'order_discount':
      parts.push(`${promotionBadge(p).replace('-', '')} de descuento en el total${p.maxDiscount ? ` (tope ${formatMoney(p.maxDiscount)})` : ''}`);
      break;
    case 'free_delivery':
      parts.push('Domicilio gratis');
      break;
    case 'bundle':
      parts.push(`Lleva ${p.buyQuantity}, paga ${p.payQuantity} en ${targetText()}`);
      break;
    case 'combo':
      parts.push(`${(p.comboItems ?? []).map((c) => `${c.quantity > 1 ? `${c.quantity} x ` : ''}${productName(c.productId)}`).join(' + ')} por ${formatMoney(p.comboPrice ?? 0)}`);
      break;
    case 'gift':
      parts.push(`Regalo: ${(p.giftQuantity ?? 1) > 1 ? `${p.giftQuantity} x ` : ''}${p.giftProductId ? productName(p.giftProductId) : 'producto'}`);
      break;
  }

  if (p.minSubtotal) parts.push(`desde ${formatMoney(p.minSubtotal)}`);
  const schedule = describeSchedule(p);
  if (schedule) parts.push(schedule);
  if (p.deliveryTypes?.length) parts.push(`solo ${p.deliveryTypes.map((d) => DELIVERY_TYPE_LABEL[d].toLowerCase()).join(' / ')}`);
  if (p.firstOrderOnly) parts.push('primer pedido');
  if (p.couponCode) parts.push(`cupón ${p.couponCode}`);
  return parts.join(' · ');
}

/** "Mar y Mié 15:00–18:00", "hasta el 2026-10-31"… (vacío si aplica siempre). */
export function describeSchedule(p: Pick<Promotion, 'schedule'>): string {
  const s = p.schedule;
  if (!s) return '';
  const parts: string[] = [];
  const days = s.daysOfWeek ?? [];
  if (days.length > 0 && days.length < 7) {
    const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    parts.push(sorted.map((d) => WEEKDAY_SHORT[d]).join(sorted.length === 2 ? ' y ' : ', '));
  }
  if (s.startTime && s.endTime) parts.push(`${s.startTime}–${s.endTime}`);
  if (s.startDate && s.endDate) parts.push(`del ${s.startDate} al ${s.endDate}`);
  else if (s.startDate) parts.push(`desde el ${s.startDate}`);
  else if (s.endDate) parts.push(`hasta el ${s.endDate}`);
  return parts.join(' ');
}

export interface ProductPromotion {
  promotion: Promotion;
  badge: string;
  // Precio con descuento (solo precio tachado)
  finalPrice?: number;
}

/**
 * Promoción para mostrar en la tarjeta del producto en el menú (precio tachado o NxM).
 * Solo considera promociones que aplican sin cupón y sin condiciones de cliente.
 */
export function getProductPromotion(
  product: { id: string; categoryId: string; price: number },
  promotions: Promotion[],
  ctx: PricingContext
): ProductPromotion | null {
  let best: ProductPromotion | null = null;
  let bestDiscount = 0;
  const line = { key: product.id, productId: product.id, categoryId: product.categoryId, quantity: 1, unitPrice: product.price, additionalsPrice: 0 };

  for (const p of promotions) {
    if (p.couponCode || p.firstOrderOnly) continue;
    if (p.type !== 'item_discount' && p.type !== 'bundle' && p.type !== 'combo') continue;
    if (ineligibilityReason(p, { ...ctx, deliveryType: '' }) !== null) continue;

    if (p.type === 'combo') {
      if (!best && p.comboItems?.some((c) => c.productId === product.id)) best = { promotion: p, badge: 'Combo' };
      continue;
    }
    const t = p.target;
    const matches = !t || t.scope === 'all'
      || (t.scope === 'categories' && !!t.categoryIds?.includes(line.categoryId))
      || (t.scope === 'products' && !!t.productIds?.includes(line.productId));
    if (!matches) continue;

    if (p.type === 'item_discount') {
      const discount = unitDiscount(p, product.price);
      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = { promotion: p, badge: promotionBadge(p), finalPrice: product.price - discount };
      }
    } else if (!best || best.finalPrice === undefined) {
      best = { promotion: p, badge: promotionBadge(p) };
    }
  }
  return best;
}
