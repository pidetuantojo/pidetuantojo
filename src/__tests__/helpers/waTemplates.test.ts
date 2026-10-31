import { describe, it, expect } from 'vitest';

import {
  DEFAULT_TEMPLATES, parseTemplateStore, statusTemplateId, templateBody, templateName,
} from '@/lib/whatsapp/templates.core';

describe('statusTemplateId', () => {
  it('sin configurar: plantilla por código, general para el resto y Cancelado en silencio', () => {
    expect(statusTemplateId({ code: 'received' })).toBe('pedido_nuevo');
    expect(statusTemplateId({ code: 'en_camino' })).toBe('pedido_en_camino');
    expect(statusTemplateId({ code: 'preparing' })).toBe('pedido_estado_actualizado');
    expect(statusTemplateId({ code: 'cancelled' })).toBeNull();
  });

  it('respeta el aviso y la plantilla elegidos en el estado', () => {
    expect(statusTemplateId({ code: 'confirmed', notifyCustomer: false })).toBeNull();
    expect(statusTemplateId({ code: 'cancelled', notifyCustomer: true })).toBe('pedido_estado_actualizado');
    expect(statusTemplateId({ code: 'empacado', waTemplateId: 'c1' })).toBe('c1');
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
