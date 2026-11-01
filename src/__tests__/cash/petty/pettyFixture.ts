// Datos ficticios de caja menor sobre el mundo de caja (nunca toca Firestore real).
import type { PettyExpense, PettyReimbursement } from '@/lib/cash/petty/petty.types';
import { isFundInvariantOk, pendingVouchersTotal } from '@/lib/cash/petty/petty.helpers';

import type { FakeFirestore } from '../../orders/fakeFirestore';
import { collectionDocs, metaFor, RID, seedCashWorld, type CashWorld } from '../cashFixture';

export const FUND = 200000;
export const MAX_EXPENSE = 50000;
export const ATTACHMENT = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/vale.jpg',
  kind: 'image' as const,
  name: 'vale.jpg',
};

export interface PettyMods {
  setup: typeof import('@/lib/ledger/setup.server');
  accounts: typeof import('@/lib/ledger/accounts.server');
  registers: typeof import('@/lib/cash/registers.server');
  settings: typeof import('@/lib/cash/settings.server');
  fund: typeof import('@/lib/cash/petty/fund.server');
  expenses: typeof import('@/lib/cash/petty/expenses.server');
  reimbursements: typeof import('@/lib/cash/petty/reimbursements.server');
  categories: typeof import('@/lib/cash/petty/categories.server');
  status: typeof import('@/lib/cash/petty/status.server');
  general: typeof import('@/lib/cash/general.server');
}

export interface PettyWorld extends CashWorld {
  petty: { register: string; accPetty: string; accAseo: string; accTransporte: string };
  categories: { aseo: string; transporte: string };
}

export async function loadPettyMods(): Promise<PettyMods> {
  return {
    setup: await import('@/lib/ledger/setup.server'),
    accounts: await import('@/lib/ledger/accounts.server'),
    registers: await import('@/lib/cash/registers.server'),
    settings: await import('@/lib/cash/settings.server'),
    fund: await import('@/lib/cash/petty/fund.server'),
    expenses: await import('@/lib/cash/petty/expenses.server'),
    reimbursements: await import('@/lib/cash/petty/reimbursements.server'),
    categories: await import('@/lib/cash/petty/categories.server'),
    status: await import('@/lib/cash/petty/status.server'),
    general: await import('@/lib/cash/general.server'),
  };
}

/** Mundo de caja + caja menor (fondo $200.000, máx. $50.000) con dos categorías; caja general con $1.000.000. */
export async function seedPettyWorld(
  db: FakeFirestore,
  m: PettyMods,
  options: { customPettyAccount?: boolean } = {}
): Promise<PettyWorld> {
  const world = await seedCashWorld(db, m);
  const accounts = await m.accounts.listAccounts(RID);
  const accPetty = options.customPettyAccount
    ? (
        await m.accounts.createAccount(
          RID,
          {
            code: '110511',
            name: 'Caja menor sucursal',
            class: 'ACTIVO',
            parentCode: '1105',
            allowsMovements: true,
          },
          metaFor('admin')
        )
      ).id
    : accounts.find((a) => a.code === '110510')!.id;
  const mkAccount = (code: string, name: string) =>
    m.accounts.createAccount(
      RID,
      { code, name, class: 'GASTO', parentCode: '5195', allowsMovements: true },
      metaFor('admin')
    );
  const aseo = await mkAccount('519510', 'Aseo y cafetería');
  const transporte = await mkAccount('519520', 'Transportes');
  const register = await m.registers.createRegister(
    RID,
    {
      type: 'MENOR',
      name: 'Caja menor',
      ledgerAccountId: accPetty,
      diffThreshold: 0,
      fundAmount: FUND,
      maxExpense: MAX_EXPENSE,
    },
    metaFor('admin')
  );
  const catAseo = await m.categories.createCategory(
    RID,
    { name: 'Aseo', ledgerAccountId: aseo.id },
    metaFor('petty1')
  );
  const catTransporte = await m.categories.createCategory(
    RID,
    { name: 'Transporte', ledgerAccountId: transporte.id },
    metaFor('petty1')
  );
  await m.general.createGeneralMovement(
    RID,
    world.ids.general,
    {
      type: 'INGRESO_VARIO',
      amount: 1000000,
      reason: 'Saldo inicial de la caja general',
      accountOverrideId: world.ids.accEquity,
    },
    metaFor('acc1')
  );
  return {
    ...world,
    petty: {
      register: register.id,
      accPetty,
      accAseo: aseo.id,
      accTransporte: transporte.id,
    },
    categories: { aseo: catAseo.id, transporte: catTransporte.id },
  };
}

export const expenseInput = (
  w: PettyWorld,
  amount: number,
  overrides: Record<string, unknown> = {}
) => ({
  registerId: w.petty.register,
  concept: 'Compra de insumos de aseo',
  thirdPartyName: 'Proveedor Ficticio SAS',
  categoryId: w.categories.aseo,
  amount,
  date: '2026-03-10',
  attachments: [] as (typeof ATTACHMENT)[],
  ...overrides,
});

export const generalSource = (w: PettyWorld) => ({
  kind: 'GENERAL' as const,
  registerId: w.ids.general,
});

/** Lee gastos/reembolsos y el efectivo de la caja menor directo del almacén en memoria. */
export function readPettyState(db: FakeFirestore, w: PettyWorld) {
  const expenses = collectionDocs(db, 'pettyCashExpenses') as unknown as PettyExpense[];
  const reimbursements = collectionDocs(
    db,
    'pettyCashReimbursements'
  ) as unknown as PettyReimbursement[];
  const balance = db.get(`restaurants/${RID}/cashRegisterBalances/${w.petty.register}`) as
    { byMethod: { efectivo?: number } } | undefined;
  const register = db.get(`restaurants/${RID}/cashRegisters/${w.petty.register}`) as {
    fundAmount: number;
    fundConstitutedAt?: string;
  };
  const cashOnHand = balance?.byMethod.efectivo ?? 0;
  return { expenses, reimbursements, cashOnHand, register };
}

/** Invariante del fondo fijo leído del almacén: efectivo + vales pendientes = fondo. */
export function assertFundInvariant(db: FakeFirestore, w: PettyWorld) {
  const { expenses, cashOnHand, register } = readPettyState(db, w);
  const snapshot = {
    fundAmount: register.fundAmount,
    constituted: Boolean(register.fundConstitutedAt),
    cashOnHand,
    expenses,
  };
  if (!isFundInvariantOk(snapshot)) {
    throw new Error(
      `Invariante roto: efectivo ${cashOnHand} + vales ${pendingVouchersTotal(expenses)} != fondo ${register.fundAmount}`
    );
  }
}
