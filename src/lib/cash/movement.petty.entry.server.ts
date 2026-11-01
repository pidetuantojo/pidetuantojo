// SOLO servidor: asiento del fondo de la caja menor (constitución, ajuste y devolución).
// Usa la regla PETTY_CASH_REPLENISH (débito caja menor / crédito origen). Al devolver fondo se
// invierten las cuentas resueltas. El origen es la cuenta de la caja general o, si se indica,
// la cuenta bancaria (override en el lado del origen).
import { resolveAccountRef, resolveRule } from '@/lib/ledger/journal.helpers';
import { preparePostEntry, type PreparedEntry } from '@/lib/ledger/journal.server';
import type { JournalEntryDraft } from '@/lib/ledger/ledger.types';

import { CashError } from './cash.errors';
import type { MovementContext } from './movement.context.server';
import type { EntryOptions, MovementForEntry } from './movement.entry.server';

export async function preparePettyFundEntry(
  ctx: MovementContext,
  movement: MovementForEntry,
  options: EntryOptions
): Promise<PreparedEntry> {
  const inbound = movement.direction === 'IN';
  const own = await ctx.registerOf(movement.registerId);
  const override = inbound ? options.creditAccountOverrideId : options.debitAccountOverrideId;

  let sourceAccountId = override;
  if (!sourceAccountId) {
    if (!movement.counterpartRegisterId) {
      throw new CashError('INVALID_REGISTER', 'Falta el origen del fondo de la caja menor');
    }
    sourceAccountId = (await ctx.registerOf(movement.counterpartRegisterId)).ledgerAccountId;
  }

  const rule = resolveRule(ctx.rules, 'PETTY_CASH_REPLENISH', null);
  const resolution = {
    sourceCashBoxAccountId: sourceAccountId,
    targetCashBoxAccountId: own.ledgerAccountId,
  };
  const debitId = resolveAccountRef(rule.debit, resolution);
  const creditId = resolveAccountRef(rule.credit, resolution);

  const draft: JournalEntryDraft = {
    accountingDate: options.accountingDate,
    event: 'PETTY_CASH_REPLENISH',
    description: `Caja menor ${movement.type}${movement.reason ? `: ${movement.reason}` : ''}`,
    sourceType: 'cashMovement',
    sourceId: movement.id,
    ruleId: rule.id,
    ruleVersion: rule.version,
    lines: inbound
      ? [
          { accountId: debitId, debit: movement.amount, credit: 0 },
          { accountId: creditId, debit: 0, credit: movement.amount },
        ]
      : [
          { accountId: creditId, debit: movement.amount, credit: 0 },
          { accountId: debitId, debit: 0, credit: movement.amount },
        ],
  };
  return preparePostEntry(ctx.tx, ctx.restaurantId, draft, ctx.audit, {
    sequences: ctx.sequences,
  });
}
