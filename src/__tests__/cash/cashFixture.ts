// Datos ficticios compartidos por los tests de caja (nunca toca Firestore real).
import type { AuditContext } from '@/lib/shared/audit.server';
import { toAccountingDate } from '@/lib/shared/bogotaDate';

import type { FakeFirestore } from '../orders/fakeFirestore';

export const RID = 'r1';

let keySeq = 0;
export const nextKey = () => `key-${String(++keySeq).padStart(8, '0')}`;

export const auditFor = (uid: string, at = '2026-03-10T15:00:00.000Z'): AuditContext => ({
  uid,
  at,
  accountingDate: toAccountingDate(at),
  ip: null,
  userAgent: null,
});

export const metaFor = (uid: string, at?: string, idempotencyKey = nextKey()) => ({
  audit: auditFor(uid, at),
  idempotencyKey,
});

export const collectionDocs = (db: FakeFirestore, name: string) =>
  Array.from(db.docs.entries())
    .filter(([path]) => path.startsWith(`restaurants/${RID}/${name}/`))
    .map(([path, data]) => ({ path, ...data }) as Record<string, unknown> & { path: string });

export interface CashWorld {
  ids: {
    general: string;
    reg1: string;
    reg2: string;
    accReg1: string;
    accGeneral: string;
    accBank: string;
    accExpense: string;
    accReceivable: string;
    accGateway: string;
    accSales: string;
    accEquity: string;
  };
}

type Modules = {
  setup: typeof import('@/lib/ledger/setup.server');
  accounts: typeof import('@/lib/ledger/accounts.server');
  registers: typeof import('@/lib/cash/registers.server');
  settings: typeof import('@/lib/cash/settings.server');
};

/** Plan de cuentas + caja general + dos registradoras (umbral $1.000) + medio Nequi. */
export async function seedCashWorld(db: FakeFirestore, m: Modules): Promise<CashWorld> {
  db.set(`restaurants/${RID}`, {
    planFeatures: ['features.cash'],
    paymentMethods: [
      { id: 'pm-efectivo', type: 'efectivo', isActive: true },
      { id: 'pm-nequi', type: 'nequi', isActive: true },
      { id: 'pm-datafono', type: 'datafono', isActive: true },
    ],
  });
  db.set(`restaurants/${RID}/orderStatuses/st-new`, { code: 'received', isActive: true });
  db.set(`restaurants/${RID}/orderStatuses/st-cancel`, { code: 'cancelled', isActive: true });
  await m.setup.setupLedger(RID, auditFor('admin'));
  const accounts = await m.accounts.listAccounts(RID);
  const byCode = (code: string) => accounts.find((a) => a.code === code)!.id;
  const reg1Account = await m.accounts.createAccount(
    RID,
    {
      code: '110515',
      name: 'Caja registradora 1',
      class: 'ACTIVO',
      parentCode: '1105',
      allowsMovements: true,
    },
    metaFor('admin')
  );
  const reg2Account = await m.accounts.createAccount(
    RID,
    {
      code: '110516',
      name: 'Caja registradora 2',
      class: 'ACTIVO',
      parentCode: '1105',
      allowsMovements: true,
    },
    metaFor('admin')
  );
  const equity = await m.accounts.createAccount(
    RID,
    { code: '3115', name: 'Aportes (saldo inicial)', class: 'PATRIMONIO', allowsMovements: true },
    metaFor('admin')
  );
  const mk = (type: 'GENERAL' | 'REGISTRADORA', name: string, ledgerAccountId: string) =>
    m.registers.createRegister(
      RID,
      { type, name, ledgerAccountId, diffThreshold: type === 'GENERAL' ? 0 : 1000 },
      metaFor('admin')
    );
  const general = await mk('GENERAL', 'Caja general', byCode('110505'));
  const reg1 = await mk('REGISTRADORA', 'Caja 1', reg1Account.id);
  const reg2 = await mk('REGISTRADORA', 'Caja 2', reg2Account.id);
  await m.settings.updateSettings(
    RID,
    {
      denominations: (await m.settings.getSettings(RID)).denominations,
      paymentMethodAccounts: { 'pm-nequi': byCode('1110') },
      defaultGeneralRegisterId: general.id,
    },
    metaFor('admin')
  );
  return {
    ids: {
      general: general.id,
      reg1: reg1.id,
      reg2: reg2.id,
      accReg1: reg1Account.id,
      accGeneral: byCode('110505'),
      accBank: byCode('1110'),
      accExpense: byCode('5195'),
      accReceivable: byCode('1365'),
      accGateway: byCode('1380'),
      accSales: byCode('4140'),
      accEquity: equity.id,
    },
  };
}

/** Pedido ficticio con total conocido (subtotal − descuento + domicilio). */
export function seedOrder(
  db: FakeFirestore,
  id: string,
  overrides: Record<string, unknown> = {}
): void {
  db.set(`restaurants/${RID}/orders/${id}`, {
    restaurantId: RID,
    orderNumber: id,
    statusId: 'st-new',
    deliveryType: 'recoger',
    subtotal: 50000,
    discount: 0,
    deliveryFee: 0,
    total: 50000,
    isPaid: false,
    items: [],
    ...overrides,
  });
}
