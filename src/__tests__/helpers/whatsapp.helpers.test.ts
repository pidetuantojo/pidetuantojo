import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWhatsAppMessage, openWhatsApp } from '@/features/menu/helpers/whatsapp.helpers';
import type { CartItem } from '@/store/cart.store';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartId: 'cart-1',
    productId: 'p1',
    productName: 'Burger',
    quantity: 1,
    unitPrice: 10000,
    subtotal: 10000,
    additionals: [],
    specialInstructions: '',
    ...overrides,
  };
}

const BASE_CHECKOUT = {
  customerName: 'Juan Pérez',
  customerPhone: '3001234567',
  deliveryType: 'recoger' as const,
  paymentLabel: 'Efectivo',
  subtotal: 10000,
};

describe('buildWhatsAppMessage', () => {
  it('incluye el nombre del restaurante', () => {
    const msg = buildWhatsAppMessage('Mi Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).toContain('Mi Restaurante');
  });

  it('incluye el nombre y teléfono del cliente', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).toContain('Juan Pérez');
    expect(msg).toContain('(300) 123-4567');
  });

  it('pedido RECOGER: muestra "Recoger en tienda", no "Domicilio"', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'recoger',
    });
    expect(msg).toContain('Recoger en tienda');
    expect(msg).not.toContain('Domicilio');
  });

  it('pedido DOMICILIO: muestra "Domicilio"', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      address: 'Calle 123',
    });
    expect(msg).toContain('Domicilio');
  });

  it('pago sin cuenta → solo la forma de pago', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).toContain('*Forma de pago:* Efectivo\n\n');
  });

  it('pago por transferencia → forma de pago y la cuenta debajo', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      paymentLabel: 'Nequi',
      paymentAccount: '3213035871',
    });
    expect(msg).toContain('*Forma de pago:* Nequi\n3213035871');
  });

  it('saludo con número de orden, restaurante y cliente', () => {
    const msg = buildWhatsAppMessage('Morcillas Rosa', [makeItem()], {
      ...BASE_CHECKOUT,
      orderNumber: '#7435',
      customerName: 'Grace Castellanos ',
    });
    expect(msg.startsWith('*Orden #7435*\nHola *Morcillas Rosa*, soy *Grace Castellanos* y me gustaría hacer un pedido.')).toBe(true);
    expect(msg.trimEnd().endsWith('Gracias.')).toBe(true);
  });

  it('sin número de orden (falló el guardado) → no muestra la línea de orden', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).not.toContain('*Orden');
  });

  it('formatea el celular del cliente', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], { ...BASE_CHECKOUT, customerPhone: '3006664779' });
    expect(msg).toContain('*Celular:* (300) 666-4779');
  });

  it('detalle de la orden: "- 1 x Producto ($precio)"', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem({ productName: 'Morcilla Para dos', subtotal: 15800 })], BASE_CHECKOUT);
    expect(msg).toContain('*Detalle de la orden:*\n- 1 x Morcilla Para dos ($15.800)');
  });

  it('no usa emojis fuera del plano básico (llegan como "�" en WhatsApp)', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem({ observacion: 'sin cebolla' })], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      address: 'Calle 1',
      location: { lat: 1, lng: 2 },
      scheduledLabel: 'viernes 26',
    });
    // Los emojis fuera del plano básico se representan como pares sustitutos en JS
    expect(/[\uD800-\uDFFF]/.test(msg)).toBe(false);
  });
});

describe('buildWhatsAppMessage — Total vs Subtotal', () => {
  it('recoger en tienda → "Total del pedido"', () => {
    const msg = buildWhatsAppMessage('R', [makeItem()], { ...BASE_CHECKOUT, deliveryType: 'recoger', subtotal: 35700 });
    expect(msg).toContain('*Total del pedido: $35.700*');
    expect(msg).not.toContain('Subtotal');
  });

  it('comer en el local → "Total del pedido"', () => {
    const msg = buildWhatsAppMessage('R', [makeItem()], { ...BASE_CHECKOUT, deliveryType: 'mesa', tableName: 'Mesa 3', subtotal: 20000 });
    expect(msg).toContain('Comer en el local — Mesa 3');
    expect(msg).toContain('*Total del pedido: $20.000*');
    expect(msg).not.toContain('Subtotal');
  });

  it('domicilio con valor conocido (zonas) → subtotal + domicilio + total', () => {
    const msg = buildWhatsAppMessage('R', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      address: 'Calle 1',
      subtotal: 30000,
      deliveryFee: 5000,
      deliveryZoneName: 'Centro',
    });
    expect(msg).toContain('Subtotal: $30.000\nDomicilio (Centro): $5.000\n*Total del pedido: $35.000*');
  });

  it('domicilio sin valor del envío → "Subtotal" y aviso', () => {
    const msg = buildWhatsAppMessage('R', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      address: 'Calle 1',
      subtotal: 30000,
    });
    expect(msg).toContain('*Subtotal del pedido: $30.000*');
    expect(msg).toContain('El valor del domicilio se confirma por este chat.');
    expect(msg).not.toContain('Total del pedido');
  });

  it('incluye dirección y barrio para domicilio', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      address: 'Calle 123 #45-67',
      barrio: 'Chapinero',
    });
    expect(msg).toContain('Calle 123 #45-67');
    expect(msg).toContain('Chapinero');
  });

  it('NO incluye dirección/barrio cuando el pedido es para recoger', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'recoger',
      address: 'Esta no debe aparecer',
      barrio: 'Este tampoco',
    });
    expect(msg).not.toContain('Esta no debe aparecer');
    expect(msg).not.toContain('Este tampoco');
  });

  it('incluye los adicionales del item', () => {
    const item = makeItem({
      additionals: [
        { name: 'Extra Queso', price: 2000 },
        { name: 'Tocino', price: 3000 },
      ],
      subtotal: 15000,
    });
    const msg = buildWhatsAppMessage('Restaurante', [item], BASE_CHECKOUT);
    expect(msg).toContain('Extra Queso');
    expect(msg).toContain('Tocino');
  });

  it('incluye la observación del item cuando existe', () => {
    const item = makeItem({ observacion: 'Sin mayonesa por favor' });
    const msg = buildWhatsAppMessage('Restaurante', [item], BASE_CHECKOUT);
    expect(msg).toContain('Sin mayonesa por favor');
  });

  it('NO incluye el emoji 📝 cuando la observación está vacía', () => {
    const item = makeItem({ observacion: '' });
    const msg = buildWhatsAppMessage('Restaurante', [item], BASE_CHECKOUT);
    expect(msg).not.toContain('📝');
  });

  it('NO incluye el emoji 📝 cuando no hay observación', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).not.toContain('📝');
  });

  it('incluye link de Google Maps cuando hay ubicación GPS', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], {
      ...BASE_CHECKOUT,
      deliveryType: 'domicilio',
      location: { lat: 4.6097, lng: -74.0817 },
    });
    expect(msg).toContain('maps.google.com');
    expect(msg).toContain('4.6097');
    expect(msg).toContain('-74.0817');
  });

  it('NO incluye link de mapa cuando no hay ubicación', () => {
    const msg = buildWhatsAppMessage('Restaurante', [makeItem()], BASE_CHECKOUT);
    expect(msg).not.toContain('maps.google.com');
  });

  it('lista todos los productos cuando hay múltiples items', () => {
    const items = [
      makeItem({ productName: 'Burger', quantity: 2, subtotal: 20000 }),
      makeItem({ cartId: 'cart-2', productId: 'p2', productName: 'Papas Fritas', quantity: 1, subtotal: 5000 }),
    ];
    const msg = buildWhatsAppMessage('Restaurante', items, BASE_CHECKOUT);
    expect(msg).toContain('Burger');
    expect(msg).toContain('Papas Fritas');
  });

  it('muestra la cantidad de cada producto con "x"', () => {
    const item = makeItem({ quantity: 3, productName: 'Pizza', subtotal: 30000 });
    const msg = buildWhatsAppMessage('Restaurante', [item], BASE_CHECKOUT);
    expect(msg).toContain('- 3 x Pizza');
    expect(msg).toContain('Pizza');
  });
});

describe('openWhatsApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('limpia caracteres no numéricos del teléfono', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    openWhatsApp('+57 (300) 123-4567', 'Hola');
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('573001234567'),
      '_blank',
    );
  });

  it('construye una URL de wa.me válida', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    openWhatsApp('3001234567', 'Test');
    const [url] = openSpy.mock.calls[0] as [string];
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });

  it('encoda el mensaje en la URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const mensaje = 'Pedido #123 — Burger';
    openWhatsApp('3001234567', mensaje);
    const [url] = openSpy.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent(mensaje));
  });

  it('abre la URL en _blank', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    openWhatsApp('3001234567', 'Test');
    expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank');
  });
});
