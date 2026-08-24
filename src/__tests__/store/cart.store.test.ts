import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, cartTotal, cartItemCount } from '@/store/cart.store';
import type { CartItem } from '@/store/cart.store';

type ItemInput = Omit<CartItem, 'cartId' | 'subtotal'>;

function makeItem(overrides: Partial<ItemInput> = {}): ItemInput {
  return {
    productId: 'p1',
    productName: 'Burger',
    quantity: 1,
    unitPrice: 10000,
    additionals: [],
    specialInstructions: '',
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({
    restaurantId: null,
    restaurantPhone: '',
    restaurantName: '',
    items: [],
    isCartOpen: false,
  });
});

describe('initCart', () => {
  it('inicializa el carrito con datos del restaurante', () => {
    useCartStore.getState().initCart('rest-1', '3001234567', 'Mi Restaurante');
    const s = useCartStore.getState();
    expect(s.restaurantId).toBe('rest-1');
    expect(s.restaurantPhone).toBe('3001234567');
    expect(s.restaurantName).toBe('Mi Restaurante');
  });

  it('limpia los items cuando cambia el restaurantId', () => {
    useCartStore.getState().initCart('rest-1', '111', 'Resto 1');
    useCartStore.getState().addItem(makeItem());
    expect(useCartStore.getState().items).toHaveLength(1);

    useCartStore.getState().initCart('rest-2', '222', 'Resto 2');
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().restaurantId).toBe('rest-2');
  });

  it('NO limpia los items cuando el restaurantId es el mismo', () => {
    useCartStore.getState().initCart('rest-1', '111', 'Resto 1');
    useCartStore.getState().addItem(makeItem());

    useCartStore.getState().initCart('rest-1', '111-actualizado', 'Resto 1 V2');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().restaurantPhone).toBe('111-actualizado');
    expect(useCartStore.getState().restaurantName).toBe('Resto 1 V2');
  });
});

describe('addItem', () => {
  beforeEach(() => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
  });

  it('agrega un item y calcula subtotal sin adicionales', () => {
    useCartStore.getState().addItem(makeItem({ unitPrice: 15000, quantity: 2 }));
    const [item] = useCartStore.getState().items;
    expect(item.subtotal).toBe(30000); // 15000 * 2
    expect(item.quantity).toBe(2);
  });

  it('agrega un item y calcula subtotal CON adicionales', () => {
    useCartStore.getState().addItem(makeItem({
      unitPrice: 10000,
      quantity: 1,
      additionals: [
        { name: 'Extra Queso', price: 2000 },
        { name: 'Tocino', price: 3000 },
      ],
    }));
    expect(useCartStore.getState().items[0].subtotal).toBe(15000); // (10000+2000+3000)*1
  });

  it('calcula subtotal correctamente con adicionales y cantidad > 1', () => {
    useCartStore.getState().addItem(makeItem({
      unitPrice: 10000,
      quantity: 3,
      additionals: [{ name: 'Extra', price: 2000 }],
    }));
    expect(useCartStore.getState().items[0].subtotal).toBe(36000); // (10000+2000)*3
  });

  it('agrega items como entradas separadas (no combina el mismo producto)', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().addItem(makeItem());
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('genera cartId único para cada item', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().addItem(makeItem());
    const ids = useCartStore.getState().items.map((i) => i.cartId);
    expect(new Set(ids).size).toBe(2);
  });

  it('preserva los datos del producto correctamente', () => {
    useCartStore.getState().addItem(makeItem({
      productId: 'pizza-especial',
      productName: 'Pizza Especial',
      productImage: 'https://example.com/pizza.jpg',
    }));
    const [item] = useCartStore.getState().items;
    expect(item.productId).toBe('pizza-especial');
    expect(item.productName).toBe('Pizza Especial');
    expect(item.productImage).toBe('https://example.com/pizza.jpg');
  });
});

describe('updateQuantity', () => {
  beforeEach(() => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
    useCartStore.getState().addItem(makeItem({ unitPrice: 10000, quantity: 1 }));
  });

  function getFirstCartId() {
    return useCartStore.getState().items[0].cartId;
  }

  it('actualiza la cantidad y recalcula el subtotal', () => {
    useCartStore.getState().updateQuantity(getFirstCartId(), 3);
    const item = useCartStore.getState().items[0];
    expect(item.quantity).toBe(3);
    expect(item.subtotal).toBe(30000);
  });

  it('recalcula subtotal correctamente con adicionales', () => {
    useCartStore.setState({ items: [] });
    useCartStore.getState().addItem(makeItem({
      unitPrice: 10000,
      quantity: 1,
      additionals: [{ name: 'Extra', price: 2000 }],
    }));
    const cartId = useCartStore.getState().items[0].cartId;
    useCartStore.getState().updateQuantity(cartId, 2);
    expect(useCartStore.getState().items[0].subtotal).toBe(24000); // (10000+2000)*2
  });

  it('elimina el item cuando la cantidad llega a 0', () => {
    useCartStore.getState().updateQuantity(getFirstCartId(), 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('elimina el item cuando la cantidad es negativa', () => {
    useCartStore.getState().updateQuantity(getFirstCartId(), -5);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('no afecta otros items al actualizar uno', () => {
    useCartStore.getState().addItem(makeItem({ productId: 'p2', productName: 'Pizza', unitPrice: 5000 }));
    const firstId = getFirstCartId();
    useCartStore.getState().updateQuantity(firstId, 5);
    expect(useCartStore.getState().items[1].quantity).toBe(1); // Pizza sin cambios
    expect(useCartStore.getState().items[1].subtotal).toBe(5000);
  });
});

describe('removeItem', () => {
  it('elimina solo el item indicado', () => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
    useCartStore.getState().addItem(makeItem({ productId: 'p1', productName: 'Burger' }));
    useCartStore.getState().addItem(makeItem({ productId: 'p2', productName: 'Pizza' }));

    const cartId = useCartStore.getState().items[0].cartId;
    useCartStore.getState().removeItem(cartId);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe('Pizza');
  });
});

describe('clearCart', () => {
  it('vacía todos los items del carrito', () => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().addItem(makeItem({ productId: 'p2' }));
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

describe('updateObservacion', () => {
  it('actualiza la observación del item correcto y no toca otros', () => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
    useCartStore.getState().addItem(makeItem({ productId: 'p1' }));
    useCartStore.getState().addItem(makeItem({ productId: 'p2' }));

    const [item1] = useCartStore.getState().items;
    useCartStore.getState().updateObservacion(item1.cartId, 'Sin sal por favor');

    expect(useCartStore.getState().items[0].observacion).toBe('Sin sal por favor');
    expect(useCartStore.getState().items[1].observacion).toBeUndefined();
  });
});

describe('selectores derivados', () => {
  beforeEach(() => {
    useCartStore.getState().initCart('rest-1', '111', 'Restaurante');
  });

  it('cartTotal: suma correctamente todos los subtotales', () => {
    useCartStore.getState().addItem(makeItem({ unitPrice: 10000, quantity: 2 })); // 20000
    useCartStore.getState().addItem(makeItem({ productId: 'p2', unitPrice: 5000, quantity: 1 })); // 5000
    expect(cartTotal(useCartStore.getState())).toBe(25000);
  });

  it('cartItemCount: suma correctamente todas las cantidades', () => {
    useCartStore.getState().addItem(makeItem({ quantity: 3 }));
    useCartStore.getState().addItem(makeItem({ productId: 'p2', quantity: 2 }));
    expect(cartItemCount(useCartStore.getState())).toBe(5);
  });

  it('cartTotal devuelve 0 con carrito vacío', () => {
    expect(cartTotal(useCartStore.getState())).toBe(0);
  });

  it('cartItemCount devuelve 0 con carrito vacío', () => {
    expect(cartItemCount(useCartStore.getState())).toBe(0);
  });

  it('cartTotal se actualiza correctamente al eliminar un item', () => {
    useCartStore.getState().addItem(makeItem({ unitPrice: 20000 }));
    useCartStore.getState().addItem(makeItem({ productId: 'p2', unitPrice: 5000 }));
    const cartId = useCartStore.getState().items[0].cartId;
    useCartStore.getState().removeItem(cartId);
    expect(cartTotal(useCartStore.getState())).toBe(5000);
  });

  it('cartTotal incluye adicionales en el cálculo', () => {
    useCartStore.getState().addItem(makeItem({
      unitPrice: 10000,
      quantity: 2,
      additionals: [{ name: 'Extra', price: 3000 }],
    })); // (10000+3000)*2 = 26000
    expect(cartTotal(useCartStore.getState())).toBe(26000);
  });
});
