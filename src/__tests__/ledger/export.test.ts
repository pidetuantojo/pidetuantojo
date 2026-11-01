import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));

import { dailyRows, pettyRows, shiftRows } from '@/features/cash/helpers/reports.export';
import {
  journalRows,
  ledgerRows,
  trialBalanceRows,
} from '@/features/ledger/helpers/export.helpers';
import type { DailySummary, PettyReport, ShiftReport } from '@/lib/cash/reports.types';
import type { JournalEntry } from '@/lib/ledger/ledger.types';
import type { LedgerReport, TrialBalanceReport } from '@/lib/ledger/reports.types';
import { csvCell, neutralizeFormula, toCsv } from '@/lib/shared/tabularExport';

describe('CSV', () => {
  it('empieza con BOM UTF-8, separa con coma y termina cada fila con CRLF', () => {
    const csv = toCsv([{ Nombre: 'Café', Monto: 1500 }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿Nombre,Monto\r\nCafé,1500\r\n');
  });

  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell('l1\r\nl2')).toBe('"l1\r\nl2"');
    expect(csvCell(null)).toBe('');
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx'])('neutraliza la fórmula %j', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
    expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('un número negativo guardado como número NO se altera; como texto sí', () => {
    expect(csvCell(-500)).toBe('-500');
    expect(csvCell('-500')).toBe("'-500");
    expect(toCsv([{ Saldo: -500 }])).toContain('\r\n-500\r\n');
  });

  it('la inyección dentro de una celda con coma queda entrecomillada y neutralizada', () => {
    expect(csvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  it('une encabezados de filas con claves distintas', () => {
    expect(toCsv([{ A: 1 }, { B: 2 }])).toBe('﻿A,B\r\n1,\r\n,2\r\n');
  });
});

const entry = (overrides: Partial<JournalEntry>): JournalEntry =>
  ({
    id: 'e1',
    number: 'CC-000001',
    accountingDate: '2026-03-10',
    event: 'SALE',
    description: 'Venta',
    sourceType: 'order',
    sourceId: 'o1',
    lines: [
      { accountId: 'a1', debit: 50000, credit: 0 },
      { accountId: 'a2', debit: 0, credit: 50000 },
    ],
    ...overrides,
  }) as JournalEntry;

describe('filas de libros', () => {
  const accounts = new Map([
    ['a1', { code: '110505', name: 'Caja general' }],
    ['a2', { code: '4140', name: 'Hoteles y restaurantes' }],
  ]);

  it('libro diario: una fila por línea con estado y montos enteros', () => {
    const rows = journalRows([entry({}), entry({ id: 'e2', reversedByEntryId: 'e3' })], accounts);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      Fecha: '2026-03-10',
      Asiento: 'CC-000001',
      'Código de cuenta': '110505',
      Débito: 50000,
      Crédito: 0,
      Estado: 'Vigente',
    });
    expect(rows[2].Estado).toBe('Reversado');
    expect(journalRows([entry({ reversesEntryId: 'e1' })], accounts)[0].Estado).toBe('Reversión');
  });

  it('libro mayor: saldo inicial, movimientos y totales', () => {
    const report = {
      from: '2026-03-01',
      to: '2026-03-31',
      openingBalance: 100,
      totalDebit: 50,
      totalCredit: 0,
      closingBalance: 150,
      lines: [
        {
          accountingDate: '2026-03-10',
          entryNumber: 'CC-000001',
          event: 'SALE',
          sourceType: 'order',
          sourceId: 'o1',
          debit: 50,
          credit: 0,
          balance: 150,
        },
      ],
    } as unknown as LedgerReport;
    const rows = ledgerRows(report);
    expect(rows.map((r) => r.Concepto)).toEqual(['Saldo inicial', '', 'Totales y saldo final']);
    expect(rows[0].Saldo).toBe(100);
    expect(rows[2].Saldo).toBe(150);
  });

  it('balance de comprobación incluye fila de totales', () => {
    const report = {
      rows: [
        {
          code: '1105',
          name: 'Caja',
          nature: 'DEBITO',
          opening: 0,
          debit: 10,
          credit: 0,
          closing: 10,
        },
      ],
      totalDebit: 10,
      totalCredit: 10,
    } as unknown as TrialBalanceReport;
    const rows = trialBalanceRows(report);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ Cuenta: 'TOTALES', Débitos: 10, Créditos: 10 });
  });
});

describe('filas de reportes de caja', () => {
  it('resumen diario: cajas y total del restaurante', () => {
    const summary = {
      date: '2026-03-10',
      registers: [
        {
          name: 'Caja 1',
          methods: [
            { methodType: 'efectivo', in: 10, out: 4, net: 6, count: 2, mirrorIn: 0, mirrorOut: 0 },
          ],
        },
      ],
      restaurantTotals: {
        methods: [{ methodType: 'efectivo', in: 10, out: 4, net: 6, count: 2 }],
      },
    } as unknown as DailySummary;
    const rows = dailyRows(summary);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Ámbito: 'Caja 1', Medio: 'Efectivo', Neto: 6 });
    expect(String(rows[1].Ámbito)).toContain('sin espejos');
  });

  it('cierre por turno: una fila por movimiento con fecha de Bogotá', () => {
    const report = {
      shift: { id: 's1' },
      register: { name: 'Caja 1' },
      cashierUid: 'u1',
      movements: [
        {
          createdAt: '2026-03-10T15:00:00.000Z',
          accountingDate: '2026-03-10',
          receiptNumber: 'RC-000001',
          type: 'VENTA',
          direction: 'IN',
          methodType: 'efectivo',
          amount: 50000,
          status: 'APLICADO',
        },
      ],
    } as unknown as ShiftReport;
    const [row] = shiftRows(report);
    expect(row).toMatchObject({ Tipo: 'Venta', Sentido: 'Entrada', Monto: 50000 });
    expect(String(row['Fecha y hora'])).toMatch(/10/);
  });

  it('caja menor: gastos y reembolsos', () => {
    const report = {
      expensesByCategory: [{ categoryName: 'Aseo', status: 'LEGALIZADO', count: 2, total: 150 }],
      reimbursements: [
        {
          requestedAt: '2026-03-10T15:00:00.000Z',
          status: 'APROBADO',
          expenseIds: ['a', 'b'],
          total: 150,
        },
      ],
    } as unknown as PettyReport;
    expect(pettyRows(report).map((r) => r.Sección)).toEqual(['Gastos', 'Reembolsos']);
  });
});
