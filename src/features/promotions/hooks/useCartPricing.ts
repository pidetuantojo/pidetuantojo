'use client';

import { useMemo } from 'react';

import type { CustomerStatusResponse } from '@/lib/orders/checkout.schema';
import type { CartItem } from '@/store/cart.store';
import type { LoyaltyConfig, OrderDeliveryType, Product, Promotion } from '@/types';

import { evaluatePromotions, type PricingProduct, type PricingResult } from '../engine';

interface CartPricingInput {
  items: CartItem[];
  products: Product[];
  promotions: Promotion[];
  now: Date;
  deliveryType: OrderDeliveryType | '';
  deliveryFee?: number;
  // Cupón validado con el servidor (las promociones con cupón no vienen en el menú)
  couponPromotion?: Promotion | null;
  couponCode?: string;
  customerStatus?: CustomerStatusResponse | null;
  loyalty?: LoyaltyConfig;
  redeemLoyalty?: boolean;
}

/**
 * Vista previa de precios del carrito con el MISMO motor que usa el servidor.
 * Es solo una vista previa: el total real lo calcula POST /api/orders.
 */
export function useCartPricing({
  items, products, promotions, now, deliveryType, deliveryFee, couponPromotion, couponCode,
  customerStatus, loyalty, redeemLoyalty = false,
}: CartPricingInput): PricingResult {
  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const pricingProducts = new Map<string, PricingProduct>(
      products.map((p) => [p.id, { name: p.name, isAvailable: p.isActive && p.isAvailable }])
    );
    const lines = items.map((item) => ({
      key: item.cartId,
      productId: item.productId,
      categoryId: byId.get(item.productId)?.categoryId ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      additionalsPrice: item.additionals.reduce((acc, a) => acc + a.price, 0),
    }));
    const all = couponPromotion && !promotions.some((p) => p.id === couponPromotion.id)
      ? [...promotions, couponPromotion]
      : promotions;

    return evaluatePromotions(lines, all, {
      now,
      deliveryType,
      deliveryFee,
      couponCode,
      customer: customerStatus ? { isNew: customerStatus.isNew, promoUses: customerStatus.promoUses } : undefined,
      loyalty: loyalty && customerStatus?.loyalty
        ? { config: loyalty, rewardAvailable: customerStatus.loyalty.rewardAvailable, redeem: redeemLoyalty }
        : undefined,
      products: pricingProducts,
    });
  }, [items, products, promotions, now, deliveryType, deliveryFee, couponPromotion, couponCode, customerStatus, loyalty, redeemLoyalty]);
}
