// El libro comparte el cliente HTTP (auth, errores con código, idempotencia) con la caja.
export { CashApiError as LedgerApiError, request } from '@/features/cash/services/cash.http';
