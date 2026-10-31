import { useCallback, useState } from 'react';

import { useToastStore } from '@/store/toast.store';

import { cashErrorMessage } from '../helpers/cash-errors.helpers';
import { cashApi } from '../services/cash.api';
import type {
  OrderPaymentResult,
  PayOrderInput,
  RefundInput,
  RefundResult,
  ReversePaymentInput,
} from '../types/cash.types';

import { useIdempotencyKey } from './useIdempotencyKey';

/**
 * Cobros, reversos y devoluciones de pedidos a través de caja. Cada función devuelve el resultado o
 * `null` si falló (el error ya se mostró en un toast). El pedido se actualiza solo por el
 * listener de Firestore: aquí no se guarda estado del pedido.
 */
export function useCashOrderActions() {
  const showToast = useToastStore((s) => s.showToast);
  const { keyFor, reset } = useIdempotencyKey();
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    async <T>(signature: string, call: (key: string) => Promise<T>): Promise<T | null> => {
      setIsPending(true);
      try {
        const result = await call(keyFor(signature));
        reset();
        return result;
      } catch (error) {
        showToast(cashErrorMessage(error), 'error');
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [keyFor, reset, showToast]
  );

  const payOrder = useCallback(
    (input: PayOrderInput): Promise<OrderPaymentResult | null> =>
      run(`pay:${JSON.stringify(input)}`, (key) => cashApi.payOrder(input, key)),
    [run]
  );

  const reversePayment = useCallback(
    (input: ReversePaymentInput): Promise<Omit<OrderPaymentResult, 'change'> | null> =>
      run(`reverse:${JSON.stringify(input)}`, (key) => cashApi.reversePayment(input, key)),
    [run]
  );

  const refund = useCallback(
    (input: RefundInput): Promise<RefundResult | null> =>
      run(`refund:${JSON.stringify(input)}`, (key) => cashApi.refund(input, key)),
    [run]
  );

  return { isPending, payOrder, reversePayment, refund };
}
