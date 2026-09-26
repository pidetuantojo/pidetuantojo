import { describe, it, expect } from 'vitest';

import { EscPos, sanitizeText, wrap } from '@/lib/printer/escpos';
import { buildOrderTicket, buildTestTicket, formatMoney } from '@/lib/printer/ticketBuilder';
import type { Order } from '@/types';

// La regla del candado vive en un módulo puro (printOrder.ts inicializa Firebase)
import { isPrintLocked, PRINT_LOCK_MS } from '@/lib/printer/printLock';

const ORDER: Order = {
  id: 'o1', restaurantId: 'r1', orderNumber: '#588416',
  customerName: 'Jesús Ramos', customerPhone: '3007581655',
  customerAddress: 'Calle 10 #19-06', barrio: 'Paraíso',
  deliveryType: 'domicilio', deliveryFee: 15000,
  paymentMethod: 'Efectivo', isPaid: false,
  items: [
    { productId: 'p1', productName: 'Maracumango', quantity: 1, unitPrice: 15000, subtotal: 18000,
      additionals: [{ name: 'Adicional de Mango', price: 3000 }], specialInstructions: 'sin azúcar' },
    { productId: 'p2', productName: 'Mangova', quantity: 1, unitPrice: 15000, subtotal: 18000, additionals: [] },
  ],
  subtotal: 36000, total: 51000, statusId: 's1',
  internalNote: 'Cliente frecuente',
  createdAt: '2026-09-25T06:59:00.000Z', updatedAt: '2026-09-25T06:59:00.000Z',
};

/** Texto visible del ticket (sin comandos ESC/GS) para aserciones legibles. */
function visible(ticket: string): string {
  return ticket
    .replace(/\x1B@/g, '')
    .replace(/\x1B[taEd!p][\s\S]/g, '')
    .replace(/\x1D![\s\S]/g, '')
    .replace(/\x1DV[\s\S]{2}/g, '')
    .replace(/\x1Bp[\s\S]{3}/g, '');
}

describe('sanitizeText', () => {
  it('cp850 conserva tildes y ñ; quita emojis y controles', () => {
    expect(sanitizeText('Jesús 🍔 piña\x1B', 'cp850')).toBe('Jesús piña');
  });

  it('ascii quita tildes', () => {
    expect(sanitizeText('Jesús piña ¿ok?', 'ascii')).toBe('Jesus pina ok?');
  });

  it('reemplaza tipografía especial', () => {
    expect(sanitizeText('Calle — 3 × 2 “ya”', 'cp850')).toBe('Calle - 3 x 2 "ya"');
  });
});

describe('wrap', () => {
  it('parte por palabras sin pasarse del ancho', () => {
    expect(wrap('Calderito de chicharron con papita criolla', 16)).toEqual(['Calderito de', 'chicharron con', 'papita criolla']);
  });

  it('corta palabras más largas que la línea', () => {
    expect(wrap('AAAAAAAAAA', 4)).toEqual(['AAAA', 'AAAA', 'AA']);
  });
});

describe('EscPos', () => {
  it('lineLR alinea el monto al borde derecho', () => {
    const out = new EscPos(58, 'cp850').lineLR('1 x Burger', '$15.000').build();
    const [line] = out.split('\n');
    expect(line).toHaveLength(32);
    expect(line.endsWith('$15.000')).toBe(true);
  });

  it('init selecciona CP850 solo con encoding cp850', () => {
    expect(new EscPos(80, 'cp850').init().build()).toBe('\x1B@\x1Bt\x02');
    expect(new EscPos(80, 'ascii').init().build()).toBe('\x1B@');
  });
});

describe('buildOrderTicket', () => {
  const ticket = buildOrderTicket(ORDER, { paperWidth: 80, encoding: 'cp850' }, { restaurantName: 'Mangova' });
  const text = visible(ticket);

  it('incluye número, tipo de entrega, cliente y dirección', () => {
    expect(text).toContain('PEDIDO #588416');
    expect(text).toContain('DOMICILIO');
    expect(text).toContain('Cliente: Jesús Ramos');
    expect(text).toContain('Dir: Calle 10 #19-06');
  });

  it('incluye items con adicionales y notas, y la nota interna', () => {
    expect(text).toMatch(/1 x Maracumango +\$18\.000/);
    expect(text).toContain('  + Adicional de Mango');
    expect(text).toContain('  * sin azúcar');
    expect(text).toContain('NOTA INTERNA:');
    expect(text).toContain('Cliente frecuente');
  });

  it('total = productos + domicilio (sin sumar el domicilio dos veces)', () => {
    expect(text).toMatch(/Productos +\$36\.000/);
    expect(text).toMatch(/Valor domicilio +\$15\.000/);
    expect(text).toMatch(/TOTAL +\$51\.000/);
  });

  it('ninguna línea se pasa del ancho del papel', () => {
    text.split('\n').forEach((l) => expect(l.length).toBeLessThanOrEqual(48));
  });

  it('termina con corte de papel', () => {
    expect(ticket.endsWith('\x1DV\x42\x03')).toBe(true);
  });
});

describe('buildOrderTicket — comer en el local y programado', () => {
  it('muestra la mesa y no la dirección', () => {
    const text = visible(buildOrderTicket(
      { ...ORDER, deliveryType: 'mesa', tableName: 'Mesa 3', deliveryFee: undefined },
      { paperWidth: 80, encoding: 'cp850' },
      { restaurantName: 'Mangova' },
    ));
    expect(text).toContain('COMER EN EL LOCAL');
    expect(text).toContain('Mesa 3');
    expect(text).not.toContain('Dir:');
    expect(text).toMatch(/TOTAL +\$36\.000/);
  });

  it('destaca la fecha programada y la cuenta de pago', () => {
    const text = visible(buildOrderTicket(
      { ...ORDER, isScheduled: true, scheduledFor: new Date(2026, 8, 26, 19, 30).toISOString(), paymentMethod: 'Nequi', paymentAccount: '3007581655' },
      { paperWidth: 80, encoding: 'cp850' },
      { restaurantName: 'Mangova' },
    ));
    expect(text).toContain('PROGRAMADO:');
    expect(text).toContain('7:30 PM');
    expect(text).toContain('Pago: Nequi 3007581655');
  });
});

describe('buildTestTicket', () => {
  it('muestra la impresora y el ancho', () => {
    const text = visible(buildTestTicket({ name: 'EPSON TM-T20', paperWidth: 58, encoding: 'ascii' }, 'Mangova'));
    expect(text).toContain('Impresora: EPSON TM-T20');
    expect(text).toContain('Papel: 58 mm (32 caracteres)');
  });
});

describe('formatMoney', () => {
  it('formato colombiano sin espacio', () => {
    expect(formatMoney(35700)).toBe('$35.700');
  });
});

describe('isPrintLocked', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');

  it('bloquea un doble click mientras se imprime', () => {
    expect(isPrintLocked({ printStatus: 'printing', printingStartedAt: new Date(now - 2000).toISOString() }, now)).toBe(true);
  });

  it('libera el candado vencido (pestaña cerrada a mitad de impresión)', () => {
    expect(isPrintLocked({ printStatus: 'printing', printingStartedAt: new Date(now - PRINT_LOCK_MS - 1).toISOString() }, now)).toBe(false);
  });

  it('permite reimprimir un pedido ya impreso o con error', () => {
    expect(isPrintLocked({ printStatus: 'printed' }, now)).toBe(false);
    expect(isPrintLocked({ printStatus: 'error' }, now)).toBe(false);
  });
});
