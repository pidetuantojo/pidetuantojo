// SOLO servidor: liquidación de datáfono. La pasarela deposita en el banco lo vendido con tarjeta:
// asiento GATEWAY_SETTLEMENT (D banco / C 1380 por cobrar), sin movimiento de caja.
// Fuera de alcance: comisiones y retenciones de la pasarela (las registra el contador aparte).
import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { resolveAccountRef, resolveRule } from '@/lib/ledger/journal.helpers';
import { preparePostEntry } from '@/lib/ledger/journal.server';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { assertMoney, MoneyError } from '@/lib/shared/money';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from './cash.errors';
import { readLedgerAccount } from './general.server';
import { createMovementContext } from './movement.context.server';

export interface SettlementInput {
  paymentMethodId: string;
  bankAccountId: string;
  amount: number;
  externalRef: string;
  accountingDate?: string;
}

export interface SettlementResult {
  entryId: string;
  entryNumber: string;
  amount: number;
  accountingDate: string;
  bankAccountId: string;
  paymentMethodId: string;
  externalRef: string;
}

export async function registerSettlement(
  restaurantId: string,
  input: SettlementInput,
  meta: MutationMeta
): Promise<SettlementResult> {
  const { audit } = meta;
  try {
    assertMoney(input.amount, { allowZero: false });
  } catch (error) {
    if (error instanceof MoneyError) throw new CashError('INVALID_AMOUNT', error.message);
    throw error;
  }
  const accountingDate = input.accountingDate ?? audit.accountingDate;
  if (accountingDate > audit.accountingDate) {
    throw new CashError('INVALID_AMOUNT', 'La fecha contable no puede ser futura');
  }

  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<SettlementResult>(tx, {
      restaurantId,
      scope: 'cash.settlement.create',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const ctx = await createMovementContext(tx, restaurantId, audit);
    const method = (await ctx.paymentMethods()).find((m) => m.id === input.paymentMethodId);
    if (!method || method.type !== 'datafono') {
      throw new CashError('INVALID_METHOD', 'La liquidación aplica solo a un medio tipo datáfono');
    }
    const bank = await readLedgerAccount(tx, restaurantId, input.bankAccountId);
    if (bank.class !== 'ACTIVO' || !isPostable(bank)) {
      throw new CashError(
        'INVALID_LEDGER_ACCOUNT',
        'La cuenta bancaria debe ser un activo activo que admita movimientos'
      );
    }

    const rule = resolveRule(ctx.rules, 'GATEWAY_SETTLEMENT', null);
    const sourceId = adminDb.collection(`restaurants/${restaurantId}/cashSettlements`).doc().id;
    const entry = await preparePostEntry(
      tx,
      restaurantId,
      {
        accountingDate,
        event: 'GATEWAY_SETTLEMENT',
        description: `Liquidación datáfono ${input.externalRef}`,
        sourceType: 'gatewaySettlement',
        sourceId,
        ruleId: rule.id,
        ruleVersion: rule.version,
        lines: [
          { accountId: bank.id, debit: input.amount, credit: 0 },
          { accountId: resolveAccountRef(rule.credit, {}), debit: 0, credit: input.amount },
        ],
      },
      audit,
      { sequences: ctx.sequences }
    );

    entry.commit(tx);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.settlement.registered',
      entityType: 'journalEntry',
      entityId: entry.entryId,
      context: audit,
      data: { amount: input.amount, paymentMethodId: input.paymentMethodId, accountingDate },
    });
    const result: SettlementResult = {
      entryId: entry.entryId,
      entryNumber: entry.number,
      amount: input.amount,
      accountingDate,
      bankAccountId: bank.id,
      paymentMethodId: input.paymentMethodId,
      externalRef: input.externalRef,
    };
    idem.save(tx, result);
    return result;
  });
}
