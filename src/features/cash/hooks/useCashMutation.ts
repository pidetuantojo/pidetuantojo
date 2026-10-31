import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useToastStore } from '@/store/toast.store';

import { cashErrorMessage } from '../helpers/cash-errors.helpers';
import { invalidateCashQueries } from '../helpers/cash-queries.helpers';

import { useIdempotencyKey } from './useIdempotencyKey';

export type CashResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

interface Options<TInput, TResult> {
  /** Identifica la intención: el reintento con los mismos datos reutiliza la llave. */
  signature: (input: TInput) => string;
  call: (input: TInput, idempotencyKey: string) => Promise<TResult>;
  successMessage?: string;
  /** false = el llamador decide qué mostrar ante el error (p. ej. mensajes neutros en el cierre). */
  toastOnError?: boolean;
}

/**
 * Mutación de caja con llave de idempotencia por intención, toast de error y refresco de las
 * consultas de caja. Devuelve un resultado en vez de lanzar, para que la pantalla decida.
 */
export function useCashMutation<TInput, TResult>(
  restaurantId: string,
  { signature, call, successMessage, toastOnError = true }: Options<TInput, TResult>
) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const { keyFor, reset } = useIdempotencyKey();
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    async (input: TInput): Promise<CashResult<TResult>> => {
      setIsPending(true);
      try {
        const data = await call(input, keyFor(signature(input)));
        reset();
        await invalidateCashQueries(queryClient, restaurantId);
        if (successMessage) showToast(successMessage);
        return { ok: true, data };
      } catch (error) {
        if (toastOnError) showToast(cashErrorMessage(error), 'error');
        return { ok: false, error };
      } finally {
        setIsPending(false);
      }
    },
    [
      call,
      keyFor,
      signature,
      reset,
      queryClient,
      restaurantId,
      successMessage,
      showToast,
      toastOnError,
    ]
  );

  return { run, isPending };
}
