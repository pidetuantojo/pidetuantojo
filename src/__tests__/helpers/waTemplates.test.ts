import { describe, it, expect } from 'vitest';

import {
  DEFAULT_TEMPLATES, parseTemplateStore, statusNotifiesAny, statusTemplateId, templateBody, templateName,
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
