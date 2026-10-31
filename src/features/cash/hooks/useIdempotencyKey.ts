import { useCallback, useRef } from 'react';

/** Llave de idempotencia estable por intención del usuario. */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Una llave por intención: el reintento del MISMO envío (misma `signature`) reutiliza la llave, así
 * el servidor no duplica el movimiento. Si cambian los datos, la llave es nueva; tras un éxito,
 * `reset()` fuerza otra.
 */
export function useIdempotencyKey() {
  const current = useRef<{ signature: string; key: string } | null>(null);

  const keyFor = useCallback((signature: string): string => {
    if (current.current?.signature !== signature) {
      current.current = { signature, key: createIdempotencyKey() };
    }
    return current.current.key;
  }, []);

  const reset = useCallback(() => {
    current.current = null;
  }, []);

  return { keyFor, reset };
}
