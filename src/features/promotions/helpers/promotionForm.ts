// Formulario por pasos de promociones (lógica pura: la usa el asistente y los tests).
import type {
  DiscountKind, OrderDeliveryType, Promotion, PromotionTarget, PromotionType, SavePromotionData,
} from '@/types';

import { normalizeCouponCode, parseTime, requiresAdvancedPlan } from '../engine';

export type PromotionStep = 'type' | 'detail' | 'when' | 'conditions' | 'presentation';
export const PROMOTION_STEPS: readonly PromotionStep[] = ['type', 'detail', 'when', 'conditions', 'presentation'];
export const PROMOTION_STEP_LABEL: Record<PromotionStep, string> = {
  type: 'Tipo',
  detail: 'Descuento',
  when: 'Cuándo',
  conditions: 'Condiciones',
  presentation: 'Cómo se ve',
};

export interface PromotionFormState {
  type: PromotionType | '';
  name: string;
  description: string;
  image: string;
  // Descuentos
  discountKind: DiscountKind;
  discountValue: string;
  maxDiscount: string;
  stackable: boolean;
  // A qué aplica
  targetScope: PromotionTarget['scope'];
  categoryIds: string[];
  productIds: string[];
  // NxM
  buyQuantity: string;
  payQuantity: string;
  // Combo
  comboItems: { productId: string; quantity: number }[];
  comboPrice: string;
  // Regalo
  giftProductId: string;
  giftQuantity: string;
  // Cuándo
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  // Condiciones
  minSubtotal: string;
  deliveryTypes: OrderDeliveryType[];
  couponCode: string;
  firstOrderOnly: boolean;
  maxUses: string;
  maxUsesPerCustomer: string;
  // Presentación
  showInMenu: boolean;
  isActive: boolean;
}

export const EMPTY_PROMOTION_FORM: PromotionFormState = {
  type: '',
  name: '',
  description: '',
  image: '',
  discountKind: 'percent',
  discountValue: '',
  maxDiscount: '',
  stackable: false,
  targetScope: 'all',
  categoryIds: [],
  productIds: [],
  buyQuantity: '2',
  payQuantity: '1',
  comboItems: [],
  comboPrice: '',
  giftProductId: '',
  giftQuantity: '1',
  startDate: '',
  endDate: '',
  daysOfWeek: [],
  startTime: '',
  endTime: '',
  minSubtotal: '',
  deliveryTypes: [],
  couponCode: '',
  firstOrderOnly: false,
  maxUses: '',
  maxUsesPerCustomer: '',
  showInMenu: true,
  isActive: true,
};

const str = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));

export function promotionToForm(p: Promotion): PromotionFormState {
  return {
    ...EMPTY_PROMOTION_FORM,
    type: p.type,
    name: p.name,
    description: p.description ?? '',
    image: p.image ?? '',
    discountKind: p.discountKind ?? 'percent',
    discountValue: str(p.discountValue),
    maxDiscount: str(p.maxDiscount),
    stackable: !!p.stackable,
    targetScope: p.target?.scope ?? 'all',
    categoryIds: p.target?.categoryIds ?? [],
    productIds: p.target?.productIds ?? [],
    buyQuantity: str(p.buyQuantity) || '2',
    payQuantity: str(p.payQuantity) || '1',
    comboItems: p.comboItems ?? [],
    comboPrice: str(p.comboPrice),
    giftProductId: p.giftProductId ?? '',
    giftQuantity: str(p.giftQuantity) || '1',
    startDate: p.schedule?.startDate ?? '',
    endDate: p.schedule?.endDate ?? '',
    daysOfWeek: p.schedule?.daysOfWeek ?? [],
    startTime: p.schedule?.startTime ?? '',
    endTime: p.schedule?.endTime ?? '',
    minSubtotal: str(p.minSubtotal),
    deliveryTypes: p.deliveryTypes ?? [],
    couponCode: p.couponCode ?? '',
    firstOrderOnly: !!p.firstOrderOnly,
    maxUses: str(p.maxUses),
    maxUsesPerCustomer: str(p.maxUsesPerCustomer),
    showInMenu: p.showInMenu,
    isActive: p.isActive,
  };
}

/** Copia pausada para repetir una promoción (ej. "el 2x1 del martes") sin rehacerla. */
export function duplicatePromotionForm(p: Promotion): PromotionFormState {
  return { ...promotionToForm(p), name: `${p.name} (copia)`.slice(0, 60), couponCode: '', isActive: false };
}

/** "15.000" / "15000" → 15000. Vacío o inválido → undefined. */
export function parseAmount(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

const COUPON_RE = /^[A-Z0-9_-]{3,20}$/;
const TARGETED_TYPES: ReadonlySet<string> = new Set(['item_discount', 'bundle']);

export interface StepValidationContext {
  advancedEnabled: boolean;
  // Otras promociones del restaurante (cupones repetidos)
  otherPromotions?: Pick<Promotion, 'id' | 'couponCode'>[];
  editingId?: string;
}

/** Mensaje de error del paso, o null si se puede continuar. */
export function validatePromotionStep(step: PromotionStep, f: PromotionFormState, ctx: StepValidationContext): string | null {
  switch (step) {
    case 'type': {
      if (!f.type) return 'Elige el tipo de promoción';
      if (!ctx.advancedEnabled && (f.type === 'bundle' || f.type === 'combo' || f.type === 'gift')) {
        return 'Este tipo de promoción requiere el plan con promociones avanzadas';
      }
      return null;
    }
    case 'detail': {
      if (TARGETED_TYPES.has(f.type)) {
        if (f.targetScope === 'categories' && f.categoryIds.length === 0) return 'Elige al menos una categoría';
        if (f.targetScope === 'products' && f.productIds.length === 0) return 'Elige al menos un producto';
      }
      if (f.type === 'item_discount' || f.type === 'order_discount') {
        const value = parseAmount(f.discountValue);
        if (!value) return f.discountKind === 'fixed_price' ? 'Escribe el precio de la oferta' : 'Escribe el valor del descuento';
        if (f.discountKind === 'percent' && value > 100) return 'El porcentaje no puede ser mayor a 100';
      }
      if (f.type === 'bundle') {
        const buy = parseAmount(f.buyQuantity) ?? 0;
        const pay = parseAmount(f.payQuantity) ?? 0;
        if (buy < 2 || buy > 10) return 'La cantidad que lleva debe estar entre 2 y 10';
        if (pay < 1 || pay >= buy) return 'Lo que paga debe ser menor que lo que lleva (ej. lleva 2, paga 1)';
      }
      if (f.type === 'combo') {
        const units = f.comboItems.reduce((acc, c) => acc + c.quantity, 0);
        if (f.comboItems.length === 0 || units < 2) return 'Un combo necesita al menos 2 productos';
        if (!parseAmount(f.comboPrice)) return 'Escribe el precio del combo';
      }
      if (f.type === 'gift' && !f.giftProductId) return 'Elige el producto de regalo';
      return null;
    }
    case 'when': {
      if (f.startDate && f.endDate && f.startDate > f.endDate) return 'La fecha de fin debe ser igual o posterior a la de inicio';
      if (!!f.startTime !== !!f.endTime) return 'Indica la hora de inicio y la de fin (o deja ambas vacías)';
      if (f.startTime && (parseTime(f.startTime) === null || parseTime(f.endTime) === null)) return 'Hora inválida';
      if (f.startTime && f.startTime === f.endTime) return 'La hora de inicio y la de fin no pueden ser iguales';
      return null;
    }
    case 'conditions': {
      const code = normalizeCouponCode(f.couponCode);
      if (code) {
        if (!ctx.advancedEnabled) return 'Los cupones requieren el plan con promociones avanzadas';
        if (!COUPON_RE.test(code)) return 'El cupón debe tener de 3 a 20 letras, números, guiones o _';
        const taken = ctx.otherPromotions?.some((p) => p.id !== ctx.editingId && normalizeCouponCode(p.couponCode) === code);
        if (taken) return 'Ya tienes otra promoción con ese cupón';
      }
      if (!ctx.advancedEnabled && (f.firstOrderOnly || parseAmount(f.maxUsesPerCustomer))) {
        return 'Los límites por cliente requieren el plan con promociones avanzadas';
      }
      if (f.type === 'free_delivery' && f.deliveryTypes.length > 0 && !f.deliveryTypes.includes('domicilio')) {
        return 'El domicilio gratis solo aplica a pedidos a domicilio';
      }
      return null;
    }
    case 'presentation': {
      const name = f.name.trim();
      if (name.length < 3) return 'Escribe un nombre de al menos 3 letras';
      if (name.length > 60) return 'El nombre puede tener máximo 60 letras';
      return null;
    }
  }
}

/** Primer paso con error (para guardar desde la edición sin recorrer el asistente). */
export function validatePromotionForm(f: PromotionFormState, ctx: StepValidationContext): { step: PromotionStep; message: string } | null {
  for (const step of PROMOTION_STEPS) {
    const message = validatePromotionStep(step, f, ctx);
    if (message) return { step, message };
  }
  return null;
}

/**
 * Datos a guardar. Los campos que no aplican al tipo quedan `undefined`
 * (al editar, el servicio los borra de Firestore).
 */
export function formToPromotion(f: PromotionFormState): SavePromotionData {
  if (!f.type) throw new Error('Tipo de promoción requerido');
  const type = f.type;
  const targeted = TARGETED_TYPES.has(type);
  const hasDiscount = type === 'item_discount' || type === 'order_discount';
  const discountKind: DiscountKind | undefined = hasDiscount
    ? (type === 'order_discount' && f.discountKind === 'fixed_price' ? 'amount' : f.discountKind)
    : undefined;

  const target: PromotionTarget | undefined = targeted
    ? f.targetScope === 'categories'
      ? { scope: 'categories', categoryIds: f.categoryIds }
      : f.targetScope === 'products'
        ? { scope: 'products', productIds: f.productIds }
        : { scope: 'all' }
    : undefined;

  const schedule = {
    ...(f.startDate ? { startDate: f.startDate } : {}),
    ...(f.endDate ? { endDate: f.endDate } : {}),
    ...(f.daysOfWeek.length > 0 && f.daysOfWeek.length < 7 ? { daysOfWeek: [...f.daysOfWeek].sort() } : {}),
    ...(f.startTime && f.endTime ? { startTime: f.startTime, endTime: f.endTime } : {}),
  };
  const couponCode = normalizeCouponCode(f.couponCode) || undefined;
  const data: SavePromotionData = {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    image: f.image || undefined,
    type,
    discountKind,
    discountValue: hasDiscount ? parseAmount(f.discountValue) : undefined,
    maxDiscount: hasDiscount && discountKind === 'percent' ? parseAmount(f.maxDiscount) : undefined,
    stackable: type === 'order_discount' ? f.stackable : undefined,
    target,
    buyQuantity: type === 'bundle' ? parseAmount(f.buyQuantity) : undefined,
    payQuantity: type === 'bundle' ? parseAmount(f.payQuantity) : undefined,
    comboItems: type === 'combo' ? f.comboItems.filter((c) => c.quantity > 0) : undefined,
    comboPrice: type === 'combo' ? parseAmount(f.comboPrice) : undefined,
    giftProductId: type === 'gift' ? f.giftProductId : undefined,
    giftQuantity: type === 'gift' ? Math.max(1, parseAmount(f.giftQuantity) ?? 1) : undefined,
    schedule: Object.keys(schedule).length > 0 ? schedule : undefined,
    minSubtotal: parseAmount(f.minSubtotal) || undefined,
    deliveryTypes: f.deliveryTypes.length > 0 && f.deliveryTypes.length < 3 ? f.deliveryTypes : undefined,
    couponCode,
    firstOrderOnly: f.firstOrderOnly || undefined,
    maxUses: parseAmount(f.maxUses) || undefined,
    maxUsesPerCustomer: parseAmount(f.maxUsesPerCustomer) || undefined,
    showInMenu: couponCode ? false : f.showInMenu,
    isActive: f.isActive,
  };
  return data;
}

/** ¿El formulario usa algo del plan avanzado? (para avisar antes de guardar). */
export function formRequiresAdvanced(f: PromotionFormState): boolean {
  if (!f.type) return false;
  return requiresAdvancedPlan({
    type: f.type,
    couponCode: normalizeCouponCode(f.couponCode) || undefined,
    firstOrderOnly: f.firstOrderOnly,
    maxUsesPerCustomer: parseAmount(f.maxUsesPerCustomer),
  });
}
