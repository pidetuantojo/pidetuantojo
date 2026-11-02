import { describe, it, expect } from 'vitest';

import {
  applyTemplate, DEFAULT_TEMPLATES, isCustomizedSystemTemplate, parseTemplateStore, paymentSummary, statusNotifiesAny, statusTemplateId, templateBody, templateName,
} from '@/lib/whatsapp/templates.core';

describe('statusTemplateId', () => {
  it('sin configurar: plantilla por código, general para el resto, Cancelado en silencio y mesa nunca', () => {
    expect(statusTemplateId({ code: 'received' }, 'recoger')).toBe('pedido_nuevo');
    expect(statusTemplateId({ code: 'en_camino' }, 'domicilio')).toBe('pedido_en_camino');
    expect(statusTemplateId({ code: 'preparing' }, 'recoger')).toBe('pedido_estado_actualizado');
    expect(statusTemplateId({ code: 'cancelled' }, 'domicilio')).toBeNull();
    expect(statusTemplateId({ code: 'received' }, 'mesa')).toBeNull();
  });

  it('el aviso se configura por método de entrega', () => {
    const listo = { code: 'ready', notifyByDelivery: { recoger: true, domicilio: false, mesa: true } };
    expect(statusTemplateId(listo, 'recoger')).toBe('pedido_estado_actualizado');
    expect(statusTemplateId(listo, 'domicilio')).toBeNull();
    expect(statusTemplateId(listo, 'mesa')).toBe('pedido_estado_actualizado');
    expect(statusNotifiesAny({ code: 'x', notifyByDelivery: { recoger: false, domicilio: false, mesa: false } })).toBe(false);
  });

  it('respeta la configuración anterior (un solo interruptor) y la plantilla elegida', () => {
    expect(statusTemplateId({ code: 'confirmed', notifyCustomer: false }, 'recoger')).toBeNull();
    expect(statusTemplateId({ code: 'cancelled', notifyCustomer: true }, 'domicilio')).toBe('pedido_estado_actualizado');
    // El interruptor viejo nunca encendía mesa
    expect(statusTemplateId({ code: 'cancelled', notifyCustomer: true }, 'mesa')).toBeNull();
    // Lo nuevo manda sobre lo viejo
    expect(statusTemplateId({ code: 'confirmed', notifyCustomer: false, notifyByDelivery: { recoger: true } }, 'recoger')).toBe('pedido_confirmado');
    expect(statusTemplateId({ code: 'empacado', waTemplateId: 'c1' }, 'recoger')).toBe('c1');
  });
});

describe('parseTemplateStore / templateBody', () => {
  const store = parseTemplateStore({
    pedido_nuevo: 'Hola nuevo',
    custom: {
      c2: { name: 'Segunda', body: 'B', createdAt: '2026-10-31T02:00:00Z' },
      c1: { name: 'Primera', body: 'A', createdAt: '2026-10-31T01:00:00Z' },
    },
  });

  it('mezcla lo guardado con los valores por defecto y ordena las propias por creación', () => {
    expect(store.system.pedido_nuevo).toBe('Hola nuevo');
    expect(store.system.pedido_pagado).toBe(DEFAULT_TEMPLATES.pedido_pagado);
    expect(store.custom.map((t) => t.id)).toEqual(['c1', 'c2']);
  });

  it('una plantilla propia borrada cae en la general', () => {
    expect(templateBody(store, 'c1')).toBe('A');
    expect(templateBody(store, 'c-borrada')).toBe(DEFAULT_TEMPLATES.pedido_estado_actualizado);
    expect(templateName(store, 'c2')).toBe('Segunda');
  });

  it('documento inexistente: todo por defecto', () => {
    expect(parseTemplateStore(undefined)).toEqual({ system: DEFAULT_TEMPLATES, custom: [] });
  });
});

describe('resumen de pago', () => {
  const base = { total: 45000, subtotal: 46000 };

  it('domicilio con descuento: productos, descuento, domicilio y total', () => {
    expect(paymentSummary({ ...base, discount: 6000, deliveryType: 'domicilio', deliveryFee: 5000 })).toBe(
      '🧾 Productos: $46.000\n🏷️ Descuento: −$6.000\n🛵 Domicilio: $5.000\n💰 *Total: $45.000*',
    );
  });

  it('para llevar sin descuento: sin líneas de domicilio ni descuento', () => {
    expect(paymentSummary({ total: 20000, subtotal: 20000, deliveryType: 'recoger', discount: 0 })).toBe(
      '🧾 Productos: $20.000\n💰 *Total: $20.000*',
    );
  });

  it('domicilio gratis o sin valor definido', () => {
    expect(paymentSummary({ ...base, deliveryType: 'domicilio', freeDelivery: true })).toContain('🛵 Domicilio: Gratis');
    expect(paymentSummary({ ...base, deliveryType: 'domicilio' })).toContain('🛵 Domicilio: Por confirmar');
  });

  it('las plantillas por defecto con total usan el resumen', () => {
    expect(DEFAULT_TEMPLATES.pedido_nuevo).toContain('{{resumenPago}}');
    expect(DEFAULT_TEMPLATES.pedido_confirmado).toContain('{{resumenPago}}');
    expect(DEFAULT_TEMPLATES.pedido_pagado).toContain('{{resumenPago}}');
  });
});

describe('plantillas guardadas por cada restaurante', () => {
  // Texto por defecto ANTERIOR, tal cual quedó guardado en restaurantes que tocaron "Guardar" sin cambiar nada
  const LEGACY_NUEVO = `Hola {{nombreCliente}}! 👋\nTu pedido *#{{numeroPedido}}* fue recibido ✅\n\n*🛒 Productos:*\n{{productos}}\n\n*💰 Total:* {{total}}\n*💳 Pago:* {{metodoPago}}`;

  it('una plantilla vieja sin personalizar recibe el texto nuevo (con el resumen de pago)', () => {
    const store = parseTemplateStore({ pedido_nuevo: LEGACY_NUEVO });
    expect(store.system.pedido_nuevo).toBe(DEFAULT_TEMPLATES.pedido_nuevo);
    expect(isCustomizedSystemTemplate('pedido_nuevo', LEGACY_NUEVO)).toBe(false);
    // También si se guardó con saltos de línea de Windows
    expect(isCustomizedSystemTemplate('pedido_nuevo', LEGACY_NUEVO.replace(/\n/g, '\r\n'))).toBe(false);
  });

  it('una plantilla que solo quitó el "#" del número (caso real) también recibe el texto nuevo', () => {
    const sinNumeral = LEGACY_NUEVO.replace('*#{{numeroPedido}}*', '*{{numeroPedido}}*');
    expect(isCustomizedSystemTemplate('pedido_nuevo', sinNumeral)).toBe(false);
    expect(parseTemplateStore({ pedido_nuevo: sinNumeral }).system.pedido_nuevo).toBe(DEFAULT_TEMPLATES.pedido_nuevo);
    // Espacios al final de línea o variantes invisibles de emoji tampoco cuentan como personalización
    expect(isCustomizedSystemTemplate('pedido_nuevo', sinNumeral.replace('✅', '✅️').replace('\n', '  \n'))).toBe(false);
  });

  it('el número de pedido sale con un solo "#", aunque la plantilla lo tenga', () => {
    expect(applyTemplate('Pedido *#{{numeroPedido}}*', { orderNumber: '#541989' })).toBe('Pedido *#541989*');
    expect(applyTemplate('Pedido *{{numeroPedido}}*', { orderNumber: '#541989' })).toBe('Pedido *#541989*');
    expect(DEFAULT_TEMPLATES.pedido_nuevo).not.toContain('#{{numeroPedido}}');
  });

  it('lo personalizado de verdad se respeta', () => {
    const mine = 'Hola {{nombreCliente}}, recibimos tu pedido 🍔';
    expect(parseTemplateStore({ pedido_nuevo: mine }).system.pedido_nuevo).toBe(mine);
    expect(isCustomizedSystemTemplate('pedido_nuevo', mine)).toBe(true);
    expect(isCustomizedSystemTemplate('pedido_nuevo', undefined)).toBe(false);
  });
});

describe('{{productos}}', () => {
  it('muestra el precio de cada línea, adicionales y regalos', () => {
    const text = applyTemplate('{{productos}}', {
      items: [
        { productName: 'Hamburguesa', quantity: 2, subtotal: 36000, additionals: ['Queso'] },
        { productName: 'Gaseosa', quantity: 1, isGift: true },
        { productName: 'Agua', quantity: 1 },
      ],
    });
    expect(text).toBe('  • 2x Hamburguesa (+ Queso) · $36.000\n  • 1x Gaseosa · Regalo 🎁\n  • 1x Agua');
  });
});
