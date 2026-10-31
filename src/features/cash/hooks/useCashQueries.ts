import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { collectPendingWithdrawals } from '../helpers/approvals.helpers';
import { cashApi } from '../services/cash.api';
import type { PendingApprovals, ShiftStatus } from '../types/cash.types';

/** Turno vigente del cajero (sin totales). `null` = no tiene turno activo. */
export function useCurrentShift(restaurantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.cashCurrentShift(restaurantId ?? ''),
    queryFn: () => cashApi.getCurrentShift(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 15,
  });
}

/** Movimientos de un turno. El cajero los recibe sin totales; el supervisor, con totales. */
export function useShiftMovements(
  restaurantId: string | undefined,
  shiftId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashShiftMovements(restaurantId ?? '', shiftId ?? ''),
    queryFn: () => cashApi.listShiftMovements(shiftId ?? ''),
    enabled: enabled && !!restaurantId && !!shiftId,
    staleTime: 1000 * 10,
  });
}

export function useRegisters(restaurantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.cashRegisters(restaurantId ?? ''),
    queryFn: () => cashApi.listRegisters(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 60,
  });
}

export function useRegisterBalance(
  restaurantId: string | undefined,
  registerId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashRegisterBalance(restaurantId ?? '', registerId ?? ''),
    queryFn: () => cashApi.getRegisterBalance(registerId ?? ''),
    enabled: enabled && !!restaurantId && !!registerId,
    staleTime: 1000 * 10,
  });
}

/** Turnos recientes, opcionalmente filtrados por estado (supervisores). */
export function useShifts(
  restaurantId: string | undefined,
  status: ShiftStatus | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashShifts(restaurantId ?? '', status ?? 'ALL'),
    queryFn: () => cashApi.listShifts(status),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 15,
  });
}

/** Cierres por aprobar + retiros parciales pendientes de los turnos que siguen activos. */
export function usePendingApprovals(restaurantId: string | undefined, enabled = true) {
  return useQuery<PendingApprovals>({
    queryKey: QUERY_KEYS.cashPendingApprovals(restaurantId ?? ''),
    queryFn: async () => {
      const shifts = await cashApi.listShifts();
      const active = shifts.filter((s) => s.status === 'ABIERTO' || s.status === 'EN_CIERRE');
      const entries = await Promise.all(
        active.map(async (shift) => ({
          shift,
          movements: (await cashApi.listShiftMovements(shift.id)).movements,
        }))
      );
      return {
        withdrawals: collectPendingWithdrawals(entries),
        closes: shifts.filter((s) => s.status === 'CERRADO_PENDIENTE_APROBACION'),
      };
    },
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30,
  });
}

/** Foto del cierre (esperado, contado, diferencias). Solo supervisores. */
export function useClosing(
  restaurantId: string | undefined,
  shiftId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: QUERY_KEYS.cashClosing(restaurantId ?? '', shiftId ?? ''),
    queryFn: () => cashApi.getClosing(shiftId ?? ''),
    enabled: enabled && !!restaurantId && !!shiftId,
    staleTime: 1000 * 30,
  });
}

/** Plan de cuentas (la API exige `ledger.view`; sin él la consulta falla y la pantalla lo avisa). */
export function useLedgerAccounts(restaurantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.ledgerAccounts(restaurantId ?? ''),
    queryFn: () => cashApi.listLedgerAccounts(),
    enabled: enabled && !!restaurantId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
