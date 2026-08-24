import { create } from 'zustand';

import type { Additional } from '@/types';

export interface CartItem {
  cartId: string;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  additionals: Additional[];
  specialInstructions: string;
  observacion?: string;
}

interface CartStore {
  restaurantId: string | null;
  restaurantPhone: string;
  restaurantName: string;
  items: CartItem[];
  isCartOpen: boolean;

  initCart: (restaurantId: string, phone: string, name: string) => void;
  addItem: (item: Omit<CartItem, 'cartId' | 'subtotal'>) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateObservacion: (cartId: string, observacion: string) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  restaurantId: null,
  restaurantPhone: '',
  restaurantName: '',
  items: [],
  isCartOpen: false,

  initCart: (restaurantId, phone, name) => {
    if (get().restaurantId !== restaurantId) {
      set({ restaurantId, restaurantPhone: phone, restaurantName: name, items: [] });
    } else {
      set({ restaurantPhone: phone, restaurantName: name });
    }
  },

  addItem: (item) => {
    const cartId = crypto.randomUUID();
    const additionalsTotal = item.additionals.reduce((acc, a) => acc + a.price, 0);
    const subtotal = (item.unitPrice + additionalsTotal) * item.quantity;
    set((s) => ({ items: [...s.items, { ...item, cartId, subtotal }] }));
  },

  removeItem: (cartId) => {
    set((s) => ({ items: s.items.filter((i) => i.cartId !== cartId) }));
  },

  updateQuantity: (cartId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(cartId);
      return;
    }
    set((s) => ({
      items: s.items.map((i) => {
        if (i.cartId !== cartId) return i;
        const additionalsTotal = i.additionals.reduce((acc, a) => acc + a.price, 0);
        return { ...i, quantity, subtotal: (i.unitPrice + additionalsTotal) * quantity };
      }),
    }));
  },

  updateObservacion: (cartId, observacion) => {
    set((s) => ({
      items: s.items.map((i) => i.cartId === cartId ? { ...i, observacion } : i),
    }));
  },

  clearCart: () => set({ items: [] }),
  setCartOpen: (open) => set({ isCartOpen: open }),
}));

// Selectores derivados
export const cartTotal = (s: CartStore) => s.items.reduce((acc, i) => acc + i.subtotal, 0);
export const cartItemCount = (s: CartStore) => s.items.reduce((acc, i) => acc + i.quantity, 0);
