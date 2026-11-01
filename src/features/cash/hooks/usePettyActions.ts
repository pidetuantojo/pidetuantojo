import { cashApi } from '../services/cash.api';
import type {
  CategoryInput,
  CreateExpenseInput,
  FundInput,
  FundResultRow,
  FundSource,
  PettyAttachment,
  PettyCategory,
  PettyExpense,
  ReimbursementRow,
  UpdateCategoryInput,
} from '../types/cash.petty.types';

import { useCashMutation } from './useCashMutation';

const sig = (name: string) => (input: unknown) => `petty:${name}:${JSON.stringify(input)}`;

/** Operación diaria de la caja menor: vales, adjuntos, legalización y anulación. */
export function usePettyExpenseActions(restaurantId: string) {
  const create = useCashMutation<CreateExpenseInput, PettyExpense>(restaurantId, {
    signature: sig('expense'),
    call: (i, key) => cashApi.createPettyExpense(i, key),
    successMessage: 'Gasto registrado',
  });

  const attach = useCashMutation<{ expenseId: string; attachment: PettyAttachment }, PettyExpense>(
    restaurantId,
    {
      signature: sig('attach'),
      call: (i, key) => cashApi.addPettyAttachment(i.expenseId, i.attachment, key),
      successMessage: 'Adjunto agregado',
    }
  );

  const legalize = useCashMutation<string, PettyExpense>(restaurantId, {
    signature: sig('legalize'),
    call: (id, key) => cashApi.legalizePettyExpense(id, key),
    successMessage: 'Gasto legalizado',
  });

  const annul = useCashMutation<{ expenseId: string; reason: string }, PettyExpense>(restaurantId, {
    signature: sig('annul'),
    call: (i, key) => cashApi.annulPettyExpense(i.expenseId, i.reason, key),
    successMessage: 'Gasto anulado',
  });

  return { create, attach, legalize, annul };
}

/** Reembolsos: solicitar (operador) y aprobar/rechazar/ajustar el fondo (quien aprueba). */
export function usePettyReimbursementActions(restaurantId: string) {
  const request = useCashMutation<{ registerId: string; expenseIds: string[] }, ReimbursementRow>(
    restaurantId,
    {
      signature: sig('reimburse'),
      call: (i, key) => cashApi.requestPettyReimbursement(i, key),
      successMessage: 'Reembolso solicitado',
    }
  );

  const approve = useCashMutation<{ id: string; source: FundSource }, ReimbursementRow>(
    restaurantId,
    {
      signature: sig('approve'),
      call: (i, key) => cashApi.approvePettyReimbursement(i.id, i.source, key),
      successMessage: 'Reembolso aprobado',
    }
  );

  const reject = useCashMutation<{ id: string; note: string }, ReimbursementRow>(restaurantId, {
    signature: sig('reject'),
    call: (i, key) => cashApi.rejectPettyReimbursement(i.id, i.note, key),
    successMessage: 'Reembolso rechazado',
  });

  const setFund = useCashMutation<{ registerId: string; input: FundInput }, FundResultRow>(
    restaurantId,
    {
      signature: sig('fund'),
      call: (i, key) => cashApi.setPettyFund(i.registerId, i.input, key),
      successMessage: 'Fondo actualizado',
    }
  );

  return { request, approve, reject, setFund };
}

/** Categorías de gasto de la caja menor. */
export function usePettyCategoryActions(restaurantId: string) {
  const create = useCashMutation<CategoryInput, PettyCategory>(restaurantId, {
    signature: sig('category:create'),
    call: (i, key) => cashApi.createPettyCategory(i, key),
    successMessage: 'Categoría creada',
  });

  const update = useCashMutation<{ id: string; input: UpdateCategoryInput }, PettyCategory>(
    restaurantId,
    {
      signature: sig('category:update'),
      call: (i, key) => cashApi.updatePettyCategory(i.id, i.input, key),
      successMessage: 'Categoría actualizada',
    }
  );

  return { create, update };
}
