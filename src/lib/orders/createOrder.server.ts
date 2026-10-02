// SOLO servidor: crea el pedido del menú público.
// El navegador manda QUÉ pidió; acá se leen los precios reales, se evalúan las promociones con la hora
// del restaurante y se guarda todo en una transacción (pedido + usos de promociones + cliente).
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { normalizePhone } from '@/lib/customers/phone';
import { loadPublicRestaurant } from '@/lib/restaurants/restaurant.server';
import {
  getCustomerProfile, getLoyaltyStatus, getReceivedStatusId, loadActivePromotions, promotionFeatures,
} from '@/lib/promotions/promotions.server';
import {
  evaluatePromotions, LOYALTY_PROMOTION_ID, type PricingLine, type PricingProduct,
} from '@/features/promotions/engine';
import { getPaymentMethodsForDelivery, getPaymentLabel, toOrderPayment } from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { Adicional, Additional, Customer, DeliveryZone, Mesa, Order, OrderItem, Product, Promotion } from '@/types';

import { CheckoutError, type CheckoutData, type CheckoutResponse } from './checkout.schema';
import { generateOrderNumber } from './orderNumber';

// Pedidos programados: mismo rango que el checkout (unos minutos de tolerancia por relojes desfasados)
const SCHEDULE_PAST_TOLERANCE_MS = 10 * 60_000;
const SCHEDULE_MAX_MS = 8 * 24 * 60 * 60_000;

const restaurantRef = (id: string) => adminDb.collection('restaurants').doc(id);

function compact<T extends Record<string, unknown>>(obj: T): T {
  // Firestore rechaza `undefined`
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

async function loadProducts(restaurantId: string, ids: string[]): Promise<Map<string, Product>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const refs = unique.map((id) => restaurantRef(restaurantId).collection('products').doc(id));
  const snaps = await adminDb.getAll(...refs);
  return new Map(snaps.filter((s) => s.exists).map((s) => [s.id, { ...(s.data() as Product), id: s.id }]));
}

function resolveAdditionals(product: Product, adicionales: Adicional[], ids: string[], names: string[]): Additional[] {
  const allowed = adicionales.filter((a) => a.isActive && product.adicionalIds?.includes(a.id));
  const byId = new Map(allowed.map((a) => [a.id, a]));
  const byName = new Map(allowed.map((a) => [a.name.trim().toLowerCase(), a]));
  const result: Additional[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const a = byId.get(id);
    if (!a) throw new CheckoutError(`Un adicional de "${product.name}" ya no está disponible. Revisa tu pedido.`, 409);
    if (!seen.has(a.id)) { seen.add(a.id); result.push({ id: a.id, name: a.name, price: a.price }); }
  }
  for (const name of names) {
    const a = byName.get(name.trim().toLowerCase());
    if (!a) throw new CheckoutError(`El adicional "${name}" de "${product.name}" ya no está disponible.`, 409);
    if (!seen.has(a.id)) { seen.add(a.id); result.push({ id: a.id, name: a.name, price: a.price }); }
  }
  return result;
}

export async function createPublicOrder(input: CheckoutData, now: Date = new Date()): Promise<CheckoutResponse> {
  const restaurant = await loadPublicRestaurant(input.restaurantId);
  if (!restaurant) throw new CheckoutError('Este restaurante no está recibiendo pedidos.', 404);
  const restaurantId = restaurant.id;

  const phoneKey = normalizePhone(input.customerPhone);
  if (!phoneKey) throw new CheckoutError('Escribe un celular válido.', 400);

  // ─── Entrega ───────────────────────────────────────────────────────────────
  const methods = restaurant.deliveryMethods;
  const deliveryActive = {
    recoger: methods?.recoger?.isActive ?? true,
    domicilio: methods?.domicilio?.isActive ?? true,
    mesa: methods?.mesa?.isActive ?? false,
  };
  const deliveryType = input.deliveryType;
  if (!deliveryActive[deliveryType]) throw new CheckoutError('Esa forma de entrega no está disponible.', 400);
  if (deliveryType === 'domicilio' && !input.customerAddress?.trim()) throw new CheckoutError('Escribe la dirección de entrega.', 400);

  let scheduledFor: string | undefined;
  if (input.scheduledFor) {
    if (deliveryType === 'mesa') throw new CheckoutError('Los pedidos en el local no se programan.', 400);
    const at = new Date(input.scheduledFor).getTime();
    if (at < now.getTime() - SCHEDULE_PAST_TOLERANCE_MS || at > now.getTime() + SCHEDULE_MAX_MS) {
      throw new CheckoutError('La fecha programada no es válida.', 400);
    }
    scheduledFor = new Date(at).toISOString();
  }

  const isZonesMode = restaurant.deliveryMode === 'zones';
  const features = promotionFeatures(restaurant);

  // ─── Datos del restaurante ─────────────────────────────────────────────────
  const [products, adicionalesSnap, zoneSnap, mesaSnap, promotions, receivedStatusId, profile] = await Promise.all([
    loadProducts(restaurantId, input.items.map((i) => i.productId)),
    restaurantRef(restaurantId).collection('adicionales').get(),
    isZonesMode && deliveryType === 'domicilio' && input.deliveryZoneId
      ? restaurantRef(restaurantId).collection('deliveryZones').doc(input.deliveryZoneId).get()
      : Promise.resolve(null),
    deliveryType === 'mesa' && input.tableId
      ? restaurantRef(restaurantId).collection('mesas').doc(input.tableId).get()
      : Promise.resolve(null),
    loadActivePromotions(restaurant, now),
    getReceivedStatusId(restaurantId),
    getCustomerProfile(restaurantId, phoneKey),
  ]);
  const adicionales = adicionalesSnap.docs.map((d) => ({ ...(d.data() as Adicional), id: d.id }));

  // Zona de domicilio (modo zonas): el valor sale de la base de datos, no del navegador
  let zone: DeliveryZone | null = null;
  if (isZonesMode && deliveryType === 'domicilio') {
    zone = zoneSnap?.exists ? { ...(zoneSnap.data() as DeliveryZone), id: zoneSnap.id } : null;
    if (!zone?.isActive) throw new CheckoutError('Elige una zona de domicilio válida.', 400);
  }
  const mesa: Mesa | null = mesaSnap?.exists ? { ...(mesaSnap.data() as Mesa), id: mesaSnap.id } : null;
  if (deliveryType === 'mesa' && input.tableId && !mesa?.isActive) throw new CheckoutError('Esa mesa no está disponible.', 400);

  // ─── Productos con precios reales ──────────────────────────────────────────
  const items: OrderItem[] = [];
  const lines: PricingLine[] = [];
  input.items.forEach((it, index) => {
    const product = products.get(it.productId);
    if (!product || !product.isActive) throw new CheckoutError('Un producto de tu pedido ya no está en el menú. Revisa tu pedido.', 409);
    if (!product.isAvailable) throw new CheckoutError(`"${product.name}" está agotado. Quítalo de tu pedido para continuar.`, 409);

    const additionals = resolveAdditionals(product, adicionales, it.additionalIds, it.additionalNames);
    const additionalsPrice = additionals.reduce((acc, a) => acc + a.price, 0);
    items.push(compact({
      productId: product.id,
      productName: product.name,
      productImage: product.image || undefined,
      quantity: it.quantity,
      unitPrice: product.price,
      subtotal: (product.price + additionalsPrice) * it.quantity,
      additionals,
      specialInstructions: it.specialInstructions,
    }));
    lines.push({
      key: String(index),
      productId: product.id,
      categoryId: product.categoryId,
      quantity: it.quantity,
      unitPrice: product.price,
      additionalsPrice,
    });
  });

  // ─── Promociones ───────────────────────────────────────────────────────────
  const giftIds = promotions.filter((p) => p.type === 'gift' && p.giftProductId).map((p) => p.giftProductId!);
  const giftProducts = await loadProducts(restaurantId, giftIds.filter((id) => !products.has(id)));
  const pricingProducts = new Map<string, PricingProduct>();
  Array.from(products.values()).concat(Array.from(giftProducts.values())).forEach((p) => {
    pricingProducts.set(p.id, { name: p.name, isAvailable: p.isActive && p.isAvailable });
  });

  const loyalty = input.redeemLoyalty ? await getLoyaltyStatus(restaurant, phoneKey, profile.customer) : null;
  if (input.redeemLoyalty && !loyalty?.rewardAvailable) {
    throw new CheckoutError('Todavía no tienes el premio de fidelidad disponible.', 409);
  }

  const pricing = evaluatePromotions(lines, promotions, {
    now,
    deliveryType,
    deliveryFee: zone ? zone.price : undefined,
    couponCode: input.couponCode,
    customer: { isNew: profile.isNew, promoUses: profile.customer?.promoUses ?? {} },
    loyalty: loyalty ? { config: loyalty.config, rewardAvailable: loyalty.rewardAvailable, redeem: input.redeemLoyalty } : undefined,
    graceIds: new Set(input.expectedPromotionIds),
    products: pricingProducts,
    features,
  });
  if (pricing.coupon && !pricing.coupon.valid) throw new CheckoutError(pricing.coupon.message, 409);

  pricing.lines.forEach((lp) => {
    const item = items[Number(lp.key)];
    if (item && lp.discount > 0) {
      item.discount = lp.discount;
      item.promotionName = lp.promotionNames.join(' + ');
    }
  });
  for (const gift of pricing.gifts) {
    const product = products.get(gift.productId) ?? giftProducts.get(gift.productId);
    items.push(compact({
      productId: gift.productId,
      productName: gift.productName,
      productImage: product?.image || undefined,
      quantity: gift.quantity,
      unitPrice: 0,
      subtotal: 0,
      additionals: [],
      specialInstructions: '',
      isGift: true,
      promotionName: gift.promotionName,
    }));
  }

  // ─── Pago ──────────────────────────────────────────────────────────────────
  const payment = getPaymentMethodsForDelivery(restaurant.paymentMethods, restaurant.deliveryMethods, deliveryType)
    .find((m) => m.id === input.paymentMethodId);
  if (!payment) throw new CheckoutError('Ese método de pago no está disponible. Elige otro.', 400);

  // ─── Pedido ────────────────────────────────────────────────────────────────
  const nowIso = now.toISOString();
  const orderRef = restaurantRef(restaurantId).collection('orders').doc();
  const appliedCoupon = pricing.applied.find((a) => a.couponCode)?.couponCode;
  const loyaltyRedeemed = pricing.applied.some((a) => a.promotionId === LOYALTY_PROMOTION_ID);
  const barrio = zone ? zone.name : input.barrio?.trim() || undefined;

  const order: Order = compact({
    id: orderRef.id,
    restaurantId,
    orderNumber: generateOrderNumber(now.getTime()),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerPhoneKey: phoneKey,
    deliveryType,
    customerAddress: deliveryType === 'domicilio' ? input.customerAddress?.trim() : undefined,
    barrio: deliveryType === 'domicilio' ? barrio : undefined,
    deliveryFee: deliveryType === 'domicilio' ? pricing.deliveryFee : undefined,
    tableId: mesa?.id,
    tableName: mesa?.name,
    isScheduled: !!scheduledFor,
    scheduledFor,
    location: deliveryType === 'domicilio' ? input.location : undefined,
    ...toOrderPayment(payment),
    isPaid: false,
    items,
    subtotal: pricing.subtotal,
    discount: pricing.discount > 0 ? pricing.discount : undefined,
    total: pricing.total,
    appliedPromotions: pricing.applied.length > 0 ? pricing.applied : undefined,
    freeDelivery: pricing.freeDelivery || undefined,
    couponCode: appliedCoupon,
    loyaltyRedeemed: loyaltyRedeemed || undefined,
    statusId: receivedStatusId,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const usedPromotions = pricing.applied
    .map((a) => promotions.find((p) => p.id === a.promotionId))
    .filter((p): p is Promotion => !!p);
  await saveOrder(restaurantId, orderRef, order, usedPromotions, {
    phoneKey,
    marketingOptIn: input.marketingOptIn,
    loyaltyRedeemed,
    nowIso,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    items: order.items,
    subtotal: order.subtotal,
    discount: pricing.discount,
    deliveryFee: order.deliveryFee,
    freeDelivery: pricing.freeDelivery,
    total: order.total,
    appliedPromotions: pricing.applied,
    deliveryZoneName: zone?.name,
    barrio: order.barrio,
    tableName: order.tableName,
    paymentLabel: getPaymentLabel(payment),
    paymentAccount: payment.account,
  };
}

/**
 * Transacción: vuelve a leer los límites de uso (dos clientes pueden pedir a la vez la última unidad
 * de "las primeras 50") y guarda pedido, usos de promociones y cliente juntos.
 */
async function saveOrder(
  restaurantId: string,
  orderRef: DocumentReference,
  order: Order,
  usedPromotions: Promotion[],
  opts: { phoneKey: string; marketingOptIn: boolean; loyaltyRedeemed: boolean; nowIso: string }
): Promise<void> {
  const customerRef = restaurantRef(restaurantId).collection('customers').doc(opts.phoneKey);
  const promoRefs = usedPromotions.map((p) => restaurantRef(restaurantId).collection('promotions').doc(p.id));

  await adminDb.runTransaction(async (tx) => {
    const [customerSnap, ...promoSnaps] = await Promise.all([tx.get(customerRef), ...promoRefs.map((ref) => tx.get(ref))]);
    const customer = customerSnap.exists ? (customerSnap.data() as Customer) : null;

    usedPromotions.forEach((p, i) => {
      const fresh = promoSnaps[i].data() as Promotion | undefined;
      if (!fresh?.isActive) throw new CheckoutError(`La promoción "${p.name}" ya no está disponible. Revisa tu pedido.`, 409);
      if (fresh.maxUses && (fresh.usesCount ?? 0) >= fresh.maxUses) {
        throw new CheckoutError(`La promoción "${p.name}" se agotó. Revisa tu pedido.`, 409);
      }
      if (fresh.firstOrderOnly && (customer?.ordersCount ?? 0) > 0) {
        throw new CheckoutError(`"${p.name}" es solo para el primer pedido.`, 409);
      }
      if (fresh.maxUsesPerCustomer && (customer?.promoUses?.[p.id] ?? 0) >= fresh.maxUsesPerCustomer) {
        throw new CheckoutError(`Ya usaste la promoción "${p.name}".`, 409);
      }
    });

    tx.set(orderRef, order);
    promoRefs.forEach((ref) => tx.update(ref, { usesCount: FieldValue.increment(1) }));

    const promoUses = Object.fromEntries(usedPromotions.map((p) => [p.id, FieldValue.increment(1)]));
    const optIn = opts.marketingOptIn ? { marketingOptIn: true, marketingOptInAt: opts.nowIso } : {};
    const loyalty = opts.loyaltyRedeemed ? { loyaltyRedeemedAt: opts.nowIso, loyaltyRedemptions: FieldValue.increment(1) } : {};

    if (customer) {
      tx.update(customerRef, {
        name: order.customerName,
        phone: order.customerPhone,
        ordersCount: FieldValue.increment(1),
        lastOrderAt: opts.nowIso,
        updatedAt: opts.nowIso,
        ...Object.fromEntries(Object.entries(promoUses).map(([id, inc]) => [`promoUses.${id}`, inc])),
        ...optIn,
        ...loyalty,
      });
    } else {
      tx.set(customerRef, {
        id: opts.phoneKey,
        restaurantId,
        phone: order.customerPhone,
        name: order.customerName,
        ordersCount: 1,
        firstOrderAt: opts.nowIso,
        lastOrderAt: opts.nowIso,
        promoUses: Object.fromEntries(usedPromotions.map((p) => [p.id, 1])),
        ...optIn,
        ...(opts.loyaltyRedeemed ? { loyaltyRedeemedAt: opts.nowIso, loyaltyRedemptions: 1 } : {}),
        updatedAt: opts.nowIso,
      });
    }
  });
}
