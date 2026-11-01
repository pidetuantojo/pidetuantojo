import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useIdempotencyKey } from '@/features/cash/hooks/useIdempotencyKey';
import { useToastStore } from '@/store/toast.store';

import { ledgerErrorMessage } from '../helpers/ledger-errors.helpers';

export type LedgerResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

interface Options<TInput, TResult> {
  /** Identifica la intención: el reintento con los mismos datos reutiliza la llave. */
  signature: (input: TInput) => string;
  call: (input: TInput, idempotencyKey: string) => Promise<TResult>;
  successMessage?: string;
  /** false = el llamador muestra el error (p. ej. dentro del formulario). */
  toastOnError?: boolean;
}

/**
 * Mutación del libro contable: llave de idempotencia por intención, toast de error y refresco de
 * las consultas `['ledger', ...]`. Devuelve un resultado en vez de lanzar.
 */
export function useLedgerMutation<TInput, TResult>({
  signature,
  call,
  successMessage,
  toastOnError = true,
}: Options<TInput, TResult>) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const { keyFor, reset } = useIdempotencyKey();
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    async (input: TInput): Promise<LedgerResult<TResult>> => {
      setIsPending(true);
      try {
        const data = await call(input, keyFor(signature(input)));
        reset();
        await queryClient.invalidateQueries({ queryKey: ['ledger'] });
        if (successMessage) showToast(successMessage);
        return { ok: true, data };
      } catch (error) {
        if (toastOnError) showToast(ledgerErrorMessage(error), 'error');
        return { ok: false, error };
      } finally {
        setIsPending(false);
      }
    },
    [call, keyFor, signature, reset, queryClient, successMessage, showToast, toastOnError]
  );

  return { run, isPending };
}
