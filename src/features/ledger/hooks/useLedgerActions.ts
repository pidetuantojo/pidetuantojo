import { ledgerApi } from '../services/ledger.api';
import type {
  CreateAccountInput,
  UpdateAccountInput,
  UpdateRuleInput,
} from '../types/ledger.types';

import { useLedgerMutation } from './useLedgerMutation';

const sig = (value: unknown) => JSON.stringify(value);

/** Plan de cuentas: crear, editar e inicializar. Los errores los muestra el formulario. */
export function useAccountActions() {
  const create = useLedgerMutation({
    signature: (input: CreateAccountInput) => sig(input),
    call: (input: CreateAccountInput, key) => ledgerApi.createAccount(input, key),
    successMessage: 'Cuenta creada',
    toastOnError: false,
  });
  const update = useLedgerMutation({
    signature: (input: { accountId: string; patch: UpdateAccountInput }) => sig(input),
    call: (input: { accountId: string; patch: UpdateAccountInput }, key) =>
      ledgerApi.updateAccount(input.accountId, input.patch, key),
    successMessage: 'Cuenta actualizada',
    toastOnError: false,
  });
  const setup = useLedgerMutation({
    signature: () => 'setup',
    call: (_: void, key) => ledgerApi.setup(key),
    successMessage: 'Plan de cuentas inicializado',
  });
  return { create, update, setup };
}

/** Reglas contables: editar (nueva versión) y desactivar. */
export function useRuleActions() {
  const update = useLedgerMutation({
    signature: (input: { ruleId: string; rule: UpdateRuleInput }) => sig(input),
    call: (input: { ruleId: string; rule: UpdateRuleInput }, key) =>
      ledgerApi.updateRule(input.ruleId, input.rule, key),
    successMessage: 'Regla actualizada: aplica a los asientos nuevos',
    toastOnError: false,
  });
  const deactivate = useLedgerMutation({
    signature: (ruleId: string) => ruleId,
    call: (ruleId: string, key) => ledgerApi.deactivateRule(ruleId, key),
    successMessage: 'Regla desactivada',
  });
  return { update, deactivate };
}

export function useReverseEntry() {
  return useLedgerMutation({
    signature: (input: { entryId: string; reason: string }) => sig(input),
    call: (input: { entryId: string; reason: string }, key) =>
      ledgerApi.reverseEntry(input.entryId, input.reason, key),
    successMessage: 'Asiento reversado',
  });
}
