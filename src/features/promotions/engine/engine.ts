// Motor de promociones (lógica pura, sin Firebase).
// El MISMO código calcula la vista previa en el carrito y el precio real en el servidor
// (src/lib/orders/createOrder.server.ts). Reglas de negocio: docs/promociones.md
import type { AppliedPromotion, LoyaltyConfig, OrderDeliveryType, Promotion } from '@/types';

import { clamp, formatMoney, roundCop } from './money';
import { isScheduleActiveAt, PROMOTION_GRACE_MINUTES, RESTAURANT_TIMEZONE, zonedParts } from './time';

export interface PricingLine {
  // Identifica la línea (cartId en el carrito, índice en el servidor)
  key: string;
  productId: string;
  categoryId: string;
  quantity: number;
  // Precio base del producto: los descuentos se calculan sobre este valor
  unitPrice: number;
  // Adicionales por unidad: se cobran completos (no se descuentan)
  additionalsPrice: number;
}

export interface PricingCustomer {
  isNew: boolean;
  promoUses: Record<string, number>;
}

export interface PricingProduct {
  name: string;
  isAvailable: boolean;
}

export interface PricingContext {
  now: Date;
  timeZone?: string;
  // '' = el cliente todavía no eligió (vista previa)
  deliveryType?: OrderDeliveryType | '';
  // Valor del domicilio ya conocido (modo zonas). undefined = se confirma por WhatsApp
  deliveryFee?: number;
  couponCode?: string;
  // undefined = todavía no se sabe quién es (vista previa sin teléfono): las condiciones por cliente
  // se asumen cumplidas, salvo "primer pedido" que nunca se asume
  customer?: PricingCustomer;
  loyalty?: { config: LoyaltyConfig; rewardAvailable: boolean; redeem: boolean };
  // Promociones que el cliente vio en el carrito: se respetan unos minutos después de vencer
  graceIds?: ReadonlySet<string>;
  // Productos del menú (regalos): nombre y disponibilidad
  products?: ReadonlyMap<string, PricingProduct>;
  // Funcionalidades del plan del restaurante
  features?: { promotions: boolean; advanced: boolean };
}

export interface LinePricing {
  key: string;
  discount: number;
  promotionNames: string[];
}

export interface GiftLine {
  productId: string;
  productName: string;
  quantity: number;
  promotionId: string;
  promotionName: string;
}

export interface PromotionNudge {
  promotionId: string;
  name: string;
  // Cuánto le falta al pedido (en productos) para ganar el beneficio
  missing: number;
  benefit: string;
}

export interface CouponStatus {
  code: string;
  // El código existe y el pedido cumple las condiciones
  valid: boolean;
  // Quedó aplicado (puede ser válido pero no aplicarse si hay una promoción mejor)
  applied: boolean;
  message: string;
}

export interface PricingResult {
  lines: LinePricing[];
  // Productos a precio de lista
  subtotal: number;
  itemsDiscount: number;
  orderDiscount: number;
  loyaltyDiscount: number;
  // itemsDiscount + orderDiscount + loyaltyDiscount
  discount: number;
  // Valor del domicilio a cobrar (0 si es gratis; undefined si se confirma después)
  deliveryFee?: number;
  freeDelivery: boolean;
  gifts: GiftLine[];
  applied: AppliedPromotion[];
  // subtotal − discount + deliveryFee
  total: number;
  nudges: PromotionNudge[];
  coupon?: CouponStatus;
}

export const LOYALTY_PROMOTION_ID = 'loyalty';
const ITEM_TYPES: ReadonlySet<Promotion['type']> = new Set<Promotion['type']>(['item_discount', 'bundle', 'combo']);
const DELIVERY_LABEL: Record<OrderDeliveryType, string> = { recoger: 'recoger en el local', domicilio: 'domicilio', mesa: 'comer en el local' };

export function normalizeCouponCode(code: string | undefined | null): string {
  return (code ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Promociones que necesitan el plan avanzado (combos, NxM, regalos, cupones y límites por cliente). */
export function requiresAdvancedPlan(p: Pick<Promotion, 'type' | 'couponCode' | 'firstOrderOnly' | 'maxUsesPerCustomer'>): boolean {
  return p.type === 'bundle' || p.type === 'combo' || p.type === 'gift'
    || !!p.couponCode || !!p.firstOrderOnly || !!p.maxUsesPerCustomer;
}

// ─── Elegibilidad ────────────────────────────────────────────────────────────

/**
 * Motivo por el que la promoción NO aplica (sin contar el pedido mínimo), o null si aplica.
 * Los mensajes se muestran al cliente cuando escribe un cupón.
 */
export function ineligibilityReason(p: Promotion, ctx: PricingContext): string | null {
  const tz = ctx.timeZone ?? RESTAURANT_TIMEZONE;
  if (!p.isActive) return 'Esta promoción no está activa.';
  if (ctx.features && (!ctx.features.promotions || (requiresAdvancedPlan(p) && !ctx.features.advanced))) {
    return 'Esta promoción no está disponible.';
  }
  if (p.maxUses && (p.usesCount ?? 0) >= p.maxUses) return 'Esta promoción ya se agotó.';

  const activeNow = isScheduleActiveAt(p.schedule, ctx.now, tz);
  const inGrace = !activeNow && !!ctx.graceIds?.has(p.id)
    && isScheduleActiveAt(p.schedule, new Date(ctx.now.getTime() - PROMOTION_GRACE_MINUTES * 60_000), tz);
  if (!activeNow && !inGrace) {
    const today = zonedParts(ctx.now, tz).date;
    if (p.schedule?.endDate && today > p.schedule.endDate) return 'Esta promoción ya venció.';
    if (p.schedule?.startDate && today < p.schedule.startDate) return 'Esta promoción todavía no empieza.';
    return 'Esta promoción no aplica en este horario.';
  }

  if (p.deliveryTypes && p.deliveryTypes.length > 0 && ctx.deliveryType && !p.deliveryTypes.includes(ctx.deliveryType)) {
    return `Solo aplica para ${p.deliveryTypes.map((d) => DELIVERY_LABEL[d]).join(' o ')}.`;
  }
  if (p.type === 'free_delivery' && ctx.deliveryType && ctx.deliveryType !== 'domicilio') {
    return 'Solo aplica para pedidos a domicilio.';
  }
  if (p.couponCode && normalizeCouponCode(ctx.couponCode) !== normalizeCouponCode(p.couponCode)) {
    return 'Necesitas el código del cupón.';
  }
  if (p.firstOrderOnly && ctx.customer?.isNew !== true) {
    return ctx.customer ? 'Solo aplica en tu primer pedido.' : 'Solo aplica en el primer pedido (se valida con tu celular).';
  }
  if (p.maxUsesPerCustomer && ctx.customer && (ctx.customer.promoUses[p.id] ?? 0) >= p.maxUsesPerCustomer) {
    return 'Ya usaste esta promoción.';
  }
  return null;
}

function meetsMinimum(p: Promotion, amount: number): boolean {
  return !p.minSubtotal || amount >= p.minSubtotal;
}

// ─── Descuentos por producto ─────────────────────────────────────────────────

function targets(p: Promotion, line: PricingLine): boolean {
  const t = p.target;
  if (!t || t.scope === 'all') return true;
  if (t.scope === 'categories') return !!t.categoryIds?.includes(line.categoryId);
  return !!t.productIds?.includes(line.productId);
}

/** Descuento por unidad de un precio tachado (sobre el precio base, sin adicionales). */
export function unitDiscount(p: Pick<Promotion, 'discountKind' | 'discountValue'>, base: number): number {
  const value = Math.max(0, p.discountValue ?? 0);
  switch (p.discountKind) {
    case 'percent':
      return clamp(base - roundCop((base * (100 - clamp(value, 0, 100))) / 100), 0, base);
    case 'amount':
      return Math.min(value, base);
    case 'fixed_price':
      return Math.max(0, base - value);
    default:
      return 0;
  }
}

interface Consumption {
  key: string;
  units: number;
  discount: number;
}

interface ItemApplication {
  promotion: Promotion;
  discount: number;
  consumption: Consumption[];
  detail?: string;
}

function itemDiscountApplication(p: Promotion, lines: PricingLine[], remaining: Map<string, number>): ItemApplication {
  const consumption: Consumption[] = [];
  let discount = 0;
  for (const line of lines) {
    const units = remaining.get(line.key) ?? 0;
    if (units <= 0 || !targets(p, line)) continue;
    const perUnit = unitDiscount(p, line.unitPrice);
    if (perUnit <= 0) continue;
    consumption.push({ key: line.key, units, discount: perUnit * units });
    discount += perUnit * units;
  }
  return { promotion: p, discount, consumption };
}

/** NxM: se ordenan las unidades de mayor a menor precio y en cada grupo de N las más baratas salen gratis. */
function bundleApplication(p: Promotion, lines: PricingLine[], remaining: Map<string, number>): ItemApplication {
  const n = Math.floor(p.buyQuantity ?? 0);
  const m = Math.floor(p.payQuantity ?? 0);
  if (n < 2 || m < 1 || m >= n) return { promotion: p, discount: 0, consumption: [] };

  const units: { key: string; price: number }[] = [];
  for (const line of lines) {
    if (!targets(p, line)) continue;
    for (let i = 0; i < (remaining.get(line.key) ?? 0); i++) units.push({ key: line.key, price: line.unitPrice });
  }
  units.sort((a, b) => b.price - a.price);

  const byKey = new Map<string, Consumption>();
  let discount = 0;
  const fullGroups = Math.floor(units.length / n);
  for (let g = 0; g < fullGroups; g++) {
    const group = units.slice(g * n, g * n + n);
    group.forEach((unit, i) => {
      const free = i >= m ? unit.price : 0;
      const c = byKey.get(unit.key) ?? { key: unit.key, units: 0, discount: 0 };
      c.units += 1;
      c.discount += free;
      byKey.set(unit.key, c);
      discount += free;
    });
  }
  return { promotion: p, discount, consumption: Array.from(byKey.values()) };
}

/** Combo: cada juego completo de productos cuesta `comboPrice`. */
function comboApplication(p: Promotion, lines: PricingLine[], remaining: Map<string, number>): ItemApplication {
  const components = (p.comboItems ?? []).filter((c) => c.quantity > 0);
  if (components.length === 0 || p.comboPrice === undefined) return { promotion: p, discount: 0, consumption: [] };

  const available = (productId: string) =>
    lines.filter((l) => l.productId === productId).reduce((acc, l) => acc + (remaining.get(l.key) ?? 0), 0);
  const priceOf = (productId: string) => lines.find((l) => l.productId === productId)?.unitPrice ?? 0;

  const sets = Math.min(...components.map((c) => Math.floor(available(c.productId) / c.quantity)));
  if (!Number.isFinite(sets) || sets <= 0) return { promotion: p, discount: 0, consumption: [] };

  const values = components.map((c) => priceOf(c.productId) * c.quantity);
  const setValue = values.reduce((a, b) => a + b, 0);
  const perSet = setValue - p.comboPrice;
  if (perSet <= 0) return { promotion: p, discount: 0, consumption: [] };
  const discount = perSet * sets;

  // Reparte el descuento entre los productos del combo según su valor (el último recibe el resto)
  const consumption: Consumption[] = [];
  let assigned = 0;
  components.forEach((component, ci) => {
    const share = ci === components.length - 1 ? discount - assigned : Math.round((discount * values[ci]) / setValue);
    assigned += share;
    let toTake = component.quantity * sets;
    const productLines = lines.filter((l) => l.productId === component.productId);
    let shareLeft = share;
    productLines.forEach((line, li) => {
      if (toTake <= 0) return;
      const units = Math.min(toTake, remaining.get(line.key) ?? 0);
      if (units <= 0) return;
      toTake -= units;
      const isLast = toTake <= 0 || li === productLines.length - 1;
      const lineShare = isLast ? shareLeft : Math.round((share * units) / (component.quantity * sets));
      shareLeft -= lineShare;
      consumption.push({ key: line.key, units, discount: lineShare });
    });
  });
  return { promotion: p, discount, consumption, detail: sets > 1 ? `${sets} combos` : undefined };
}

function itemApplication(p: Promotion, lines: PricingLine[], remaining: Map<string, number>): ItemApplication {
  if (p.type === 'bundle') return bundleApplication(p, lines, remaining);
  if (p.type === 'combo') return comboApplication(p, lines, remaining);
  return itemDiscountApplication(p, lines, remaining);
}

// ─── Descuento al total ──────────────────────────────────────────────────────

function orderDiscountAmount(p: Promotion, base: number): number {
  if (base <= 0) return 0;
  const value = Math.max(0, p.discountValue ?? 0);
  let amount = p.discountKind === 'percent' ? roundCop((base * clamp(value, 0, 100)) / 100) : value;
  if (p.maxDiscount) amount = Math.min(amount, p.maxDiscount);
  return clamp(amount, 0, base);
}

function loyaltyAmount(config: LoyaltyConfig, base: number): number {
  if (base <= 0) return 0;
  let amount = config.rewardKind === 'percent'
    ? roundCop((base * clamp(config.rewardValue, 0, 100)) / 100)
    : config.rewardValue;
  if (config.maxReward) amount = Math.min(amount, config.maxReward);
  return clamp(amount, 0, base);
}

// ─── Evaluación ──────────────────────────────────────────────────────────────

/**
 * Calcula precios con promociones. Reglas:
 * 1. Cada unidad recibe como máximo UN descuento por producto (precio tachado, NxM o combo).
 *    Se aplica primero la promoción que más ahorra al cliente.
 * 2. Descuento al total: se aplica solo el mejor. Si no es acumulable, no descuenta sobre
 *    productos que ya tienen un descuento por producto.
 * 3. Premio de fidelidad, domicilio gratis y regalos se suman a lo anterior.
 * 4. Los pedidos mínimos se comparan con los productos después de los descuentos por producto.
 */
export function evaluatePromotions(lines: PricingLine[], promotions: Promotion[], ctx: PricingContext): PricingResult {
  const cleanLines = lines.filter((l) => l.quantity > 0).map((l) => ({ ...l, quantity: Math.floor(l.quantity) }));
  const subtotal = cleanLines.reduce((acc, l) => acc + (l.unitPrice + l.additionalsPrice) * l.quantity, 0);
  const eligible = promotions.filter((p) => ineligibilityReason(p, ctx) === null);

  // 1. Descuentos por producto (greedy: la que más ahorra primero)
  const remaining = new Map(cleanLines.map((l) => [l.key, l.quantity]));
  const lineDiscount = new Map<string, LinePricing>(cleanLines.map((l) => [l.key, { key: l.key, discount: 0, promotionNames: [] }]));
  const applied: AppliedPromotion[] = [];
  let itemsDiscount = 0;

  let candidates = eligible.filter((p) => ITEM_TYPES.has(p.type) && meetsMinimum(p, subtotal));
  for (;;) {
    let best: ItemApplication | null = null;
    for (const p of candidates) {
      const app = itemApplication(p, cleanLines, remaining);
      if (app.discount > 0 && (!best || app.discount > best.discount)) best = app;
    }
    if (!best) break;
    const bestApp = best;
    candidates = candidates.filter((p) => p.id !== bestApp.promotion.id);
    for (const c of bestApp.consumption) {
      remaining.set(c.key, (remaining.get(c.key) ?? 0) - c.units);
      const lp = lineDiscount.get(c.key)!;
      lp.discount += c.discount;
      if (c.discount > 0 && !lp.promotionNames.includes(bestApp.promotion.name)) lp.promotionNames.push(bestApp.promotion.name);
    }
    itemsDiscount += bestApp.discount;
    applied.push(toApplied(bestApp.promotion, bestApp.discount, bestApp.detail));
  }

  const afterItems = subtotal - itemsDiscount;
  // Unidades sin descuento por producto (base de los descuentos al total no acumulables)
  const untouched = cleanLines.reduce((acc, l) => acc + (remaining.get(l.key) ?? 0) * (l.unitPrice + l.additionalsPrice), 0);

  // 2. Descuento al total: el mejor
  let orderDiscount = 0;
  let orderPromo: Promotion | null = null;
  for (const p of eligible) {
    if (p.type !== 'order_discount' || !meetsMinimum(p, afterItems)) continue;
    const amount = orderDiscountAmount(p, p.stackable ? afterItems : Math.min(untouched, afterItems));
    if (amount > orderDiscount) { orderDiscount = amount; orderPromo = p; }
  }
  if (orderPromo) applied.push(toApplied(orderPromo, orderDiscount));

  // 3. Premio de fidelidad
  let loyaltyDiscount = 0;
  const loyalty = ctx.loyalty;
  if (loyalty?.redeem && loyalty.rewardAvailable && loyalty.config.isActive && (!ctx.features || ctx.features.advanced)) {
    loyaltyDiscount = loyaltyAmount(loyalty.config, afterItems - orderDiscount);
    if (loyaltyDiscount > 0) {
      applied.push({ promotionId: LOYALTY_PROMOTION_ID, name: 'Premio de fidelidad', type: 'loyalty', amount: loyaltyDiscount });
    }
  }

  // 4. Domicilio gratis
  const freeDeliveryPromo = ctx.deliveryType === 'domicilio'
    ? eligible.find((p) => p.type === 'free_delivery' && meetsMinimum(p, afterItems))
    : undefined;
  const freeDelivery = !!freeDeliveryPromo;
  if (freeDeliveryPromo) applied.push(toApplied(freeDeliveryPromo, ctx.deliveryFee ?? 0, 'Domicilio gratis'));
  const deliveryFee = freeDelivery ? 0 : ctx.deliveryFee;

  // 5. Regalos
  const gifts: GiftLine[] = [];
  for (const p of eligible) {
    if (p.type !== 'gift' || !p.giftProductId || !meetsMinimum(p, afterItems)) continue;
    const product = ctx.products?.get(p.giftProductId);
    if (!product?.isAvailable) continue;
    const quantity = Math.max(1, Math.floor(p.giftQuantity ?? 1));
    gifts.push({ productId: p.giftProductId, productName: product.name, quantity, promotionId: p.id, promotionName: p.name });
    applied.push(toApplied(p, 0, `Regalo: ${quantity > 1 ? `${quantity} x ` : ''}${product.name}`));
  }

  const discount = itemsDiscount + orderDiscount + loyaltyDiscount;
  const total = Math.max(0, subtotal - discount) + (deliveryFee ?? 0);

  return {
    lines: Array.from(lineDiscount.values()),
    subtotal,
    itemsDiscount,
    orderDiscount,
    loyaltyDiscount,
    discount,
    deliveryFee,
    freeDelivery,
    gifts,
    applied,
    total,
    nudges: buildNudges(promotions, ctx, afterItems, { freeDelivery, hasOrderDiscount: orderDiscount > 0, giftIds: new Set(gifts.map((g) => g.promotionId)) }),
    coupon: couponStatus(promotions, ctx, subtotal, afterItems, applied),
  };
}

function toApplied(p: Promotion, amount: number, detail?: string): AppliedPromotion {
  return {
    promotionId: p.id,
    name: p.name,
    type: p.type,
    amount,
    ...(p.couponCode ? { couponCode: normalizeCouponCode(p.couponCode) } : {}),
    ...(detail ? { detail } : {}),
  };
}

function buildNudges(
  promotions: Promotion[],
  ctx: PricingContext,
  afterItems: number,
  state: { freeDelivery: boolean; hasOrderDiscount: boolean; giftIds: Set<string> }
): PromotionNudge[] {
  const nudges: PromotionNudge[] = [];
  for (const p of promotions) {
    if (!p.minSubtotal || afterItems >= p.minSubtotal || afterItems <= 0) continue;
    if (ineligibilityReason(p, ctx) !== null) continue;
    let benefit: string | null = null;
    if (p.type === 'free_delivery' && !state.freeDelivery && ctx.deliveryType !== 'recoger' && ctx.deliveryType !== 'mesa') {
      benefit = 'domicilio gratis';
    } else if (p.type === 'order_discount' && !state.hasOrderDiscount) {
      benefit = p.discountKind === 'percent' ? `${p.discountValue}% de descuento` : `${formatMoney(p.discountValue ?? 0)} de descuento`;
    } else if (p.type === 'gift' && !state.giftIds.has(p.id) && p.giftProductId) {
      const product = ctx.products?.get(p.giftProductId);
      if (product?.isAvailable) benefit = `un regalo: ${product.name}`;
    }
    if (benefit) nudges.push({ promotionId: p.id, name: p.name, missing: p.minSubtotal - afterItems, benefit });
  }
  return nudges.sort((a, b) => a.missing - b.missing).slice(0, 2);
}

function couponStatus(
  promotions: Promotion[],
  ctx: PricingContext,
  subtotal: number,
  afterItems: number,
  applied: AppliedPromotion[]
): CouponStatus | undefined {
  const code = normalizeCouponCode(ctx.couponCode);
  if (!code) return undefined;
  const promo = promotions.find((p) => p.couponCode && normalizeCouponCode(p.couponCode) === code);
  if (!promo) return { code, valid: false, applied: false, message: 'Este cupón no existe o ya no está disponible.' };

  const reason = ineligibilityReason(promo, ctx);
  if (reason) return { code, valid: false, applied: false, message: reason };
  // Los descuentos por producto miden el mínimo antes de descontar; el resto, después
  if (!meetsMinimum(promo, ITEM_TYPES.has(promo.type) ? subtotal : afterItems)) {
    return { code, valid: false, applied: false, message: `Pedido mínimo de ${formatMoney(promo.minSubtotal ?? 0)} para usar este cupón.` };
  }
  const isApplied = applied.some((a) => a.promotionId === promo.id);
  return isApplied
    ? { code, valid: true, applied: true, message: `Cupón aplicado: ${promo.name}` }
    : { code, valid: true, applied: false, message: 'El cupón es válido, pero tu pedido ya tiene una promoción mejor.' };
}
