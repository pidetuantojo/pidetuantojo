import { ACCOUNTING_EVENTS } from '@/lib/ledger/ledger.types';

import type { AccountingEvent, AccountingRule, AccountRef } from '../types/ledger.types';

export const isLiveRule = (rule: AccountingRule): boolean => rule.isActive && !rule.supersededAt;

export interface RuleGroup {
  event: AccountingEvent;
  rules: AccountingRule[];
}

/** Reglas agrupadas por evento (orden del catálogo); sin historial solo las vigentes. */
export function groupRulesByEvent(
  rules: readonly AccountingRule[],
  showHistory: boolean
): RuleGroup[] {
  return ACCOUNTING_EVENTS.map((event) => ({
    event,
    rules: rules
      .filter((r) => r.event === event && (showHistory || isLiveRule(r)))
      .sort(
        (a, b) => (a.methodType ?? '').localeCompare(b.methodType ?? '') || b.version - a.version
      ),
  })).filter((group) => group.rules.length > 0);
}

/** Cuenta fija elegida en una referencia (o cadena vacía si no es fija). */
export const refAccountId = (ref: AccountRef): string =>
  ref.kind === 'fixed' ? ref.accountId : '';

export function buildRef(kind: AccountRef['kind'], accountId: string): AccountRef {
  return kind === 'fixed' ? { kind, accountId } : ({ kind } as AccountRef);
}

export function isRefComplete(ref: AccountRef): boolean {
  return ref.kind !== 'fixed' || ref.accountId.length > 0;
}
