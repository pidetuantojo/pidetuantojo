// Funciones puras de los reportes de caja: agrupaciones y totales.
import type { PaymentMethodType } from '@/types';

import type { CashMovement, CashRegister } from './cash.types';
import type { PettyExpense } from './petty/petty.types';
import type {
  DailySummary,
  MethodTotals,
  PettyCategoryGroup,
  RegisterDailySummary,
  RestaurantMethodTotals,
} from './reports.types';

export const DAILY_RULE =
  'Cada caja muestra todos sus movimientos aplicados del día, incluidos los espejos de traslados ' +
  '(marcados aparte). Los totales del restaurante excluyen los espejos para no contar dos veces ' +
  'el mismo traslado.';

type SummaryMovement = Pick<
  CashMovement,
  'registerId' | 'direction' | 'amount' | 'methodType' | 'mirrorOfMovementId'
>;

const emptyMethod = (methodType: PaymentMethodType): MethodTotals => ({
  methodType,
  in: 0,
  out: 0,
  net: 0,
  count: 0,
  mirrorIn: 0,
  mirrorOut: 0,
});

function rowFor(map: Map<PaymentMethodType, MethodTotals>, methodType: PaymentMethodType) {
  const existing = map.get(methodType);
  if (existing) return existing;
  const created = emptyMethod(methodType);
  map.set(methodType, created);
  return created;
}

function accumulate(row: MethodTotals, m: SummaryMovement) {
  const isIn = m.direction === 'IN';
  row.count += 1;
  if (isIn) row.in += m.amount;
  else row.out += m.amount;
  row.net = row.in - row.out;
  if (m.mirrorOfMovementId) {
    if (isIn) row.mirrorIn += m.amount;
    else row.mirrorOut += m.amount;
  }
}

const sumRows = (rows: readonly { in: number; out: number; count: number }[]) => {
  const inn = rows.reduce((t, r) => t + r.in, 0);
  const out = rows.reduce((t, r) => t + r.out, 0);
  return { in: inn, out, net: inn - out, count: rows.reduce((t, r) => t + r.count, 0) };
};

export function buildDailySummary(
  date: string,
  registers: readonly Pick<CashRegister, 'id' | 'name' | 'type'>[],
  movements: readonly SummaryMovement[]
): DailySummary {
  const byRegister = new Map<string, Map<PaymentMethodType, MethodTotals>>();
  const restaurant = new Map<PaymentMethodType, MethodTotals>();

  movements.forEach((m) => {
    const methods = byRegister.get(m.registerId) ?? new Map<PaymentMethodType, MethodTotals>();
    byRegister.set(m.registerId, methods);
    accumulate(rowFor(methods, m.methodType), m);
    if (m.mirrorOfMovementId) return;
    accumulate(rowFor(restaurant, m.methodType), m);
  });

  const known = new Map(registers.map((r) => [r.id, r]));
  const registerIds = Array.from(byRegister.keys());
  const summaries: RegisterDailySummary[] = registerIds
    .map((id) => {
      const methods = Array.from(byRegister.get(id)?.values() ?? []).sort((a, b) =>
        a.methodType.localeCompare(b.methodType)
      );
      return {
        registerId: id,
        name: known.get(id)?.name ?? 'Caja eliminada',
        type: known.get(id)?.type ?? null,
        methods,
        totals: sumRows(methods),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const methods: RestaurantMethodTotals[] = Array.from(restaurant.values())
    .map(({ methodType, in: inn, out, net, count }) => ({ methodType, in: inn, out, net, count }))
    .sort((a, b) => a.methodType.localeCompare(b.methodType));
  return {
    date,
    rule: DAILY_RULE,
    registers: summaries,
    restaurantTotals: { methods, ...sumRows(methods) },
  };
}

/** Agrupa gastos por categoría y estado, ordenado por categoría y estado. */
export function groupExpenses(
  expenses: readonly Pick<PettyExpense, 'categoryId' | 'categoryName' | 'status' | 'amount'>[]
): PettyCategoryGroup[] {
  const groups = new Map<string, PettyCategoryGroup>();
  expenses.forEach((e) => {
    const key = `${e.categoryId}|${e.status}`;
    const group = groups.get(key) ?? {
      categoryId: e.categoryId,
      categoryName: e.categoryName,
      status: e.status,
      count: 0,
      total: 0,
    };
    group.count += 1;
    group.total += e.amount;
    groups.set(key, group);
  });
  return Array.from(groups.values()).sort(
    (a, b) => a.categoryName.localeCompare(b.categoryName) || a.status.localeCompare(b.status)
  );
}
