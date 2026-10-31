import type {
  ApproveCloseInput,
  CashClosing,
  CurrentShift,
  ManualMovementInput,
  MovementRow,
  OpenShiftInput,
  ShiftAck,
  ShiftMovementsView,
  ShiftRow,
  ShiftStatus,
  SubmitCountInput,
  WithdrawalDecisionInput,
} from '../types/cash.types';

import { request } from './cash.http';

const enc = encodeURIComponent;

/** Turnos del cajero, movimientos, cierre ciego y aprobaciones. */
export const cashShiftsApi = {
  getCurrentShift: async () =>
    (await request<{ shift: CurrentShift | null }>('/api/cash/shifts/current')).shift,

  openShift: (input: OpenShiftInput, idempotencyKey: string) =>
    request<ShiftRow>('/api/cash/shifts', { method: 'POST', body: input, idempotencyKey }),

  listShifts: async (status?: ShiftStatus) =>
    (
      await request<{ shifts: ShiftRow[] }>(
        status ? `/api/cash/shifts?status=${enc(status)}` : '/api/cash/shifts'
      )
    ).shifts,

  listShiftMovements: (shiftId: string) =>
    request<ShiftMovementsView>(`/api/cash/shifts/${enc(shiftId)}/movements`),

  createShiftMovement: (shiftId: string, input: ManualMovementInput, idempotencyKey: string) =>
    request<MovementRow>(`/api/cash/shifts/${enc(shiftId)}/movements`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  decideWithdrawal: (
    shiftId: string,
    movementId: string,
    input: WithdrawalDecisionInput,
    idempotencyKey: string
  ) =>
    request<MovementRow>(`/api/cash/shifts/${enc(shiftId)}/movements/${enc(movementId)}/approve`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  reverseMovement: (movementId: string, reason: string, idempotencyKey: string) =>
    request<MovementRow>(`/api/cash/movements/${enc(movementId)}/reverse`, {
      method: 'POST',
      body: { reason },
      idempotencyKey,
    }),

  startClose: (shiftId: string, idempotencyKey: string) =>
    request<ShiftAck>(`/api/cash/shifts/${enc(shiftId)}/start-close`, {
      method: 'POST',
      body: {},
      idempotencyKey,
    }),

  submitCount: (shiftId: string, input: SubmitCountInput, idempotencyKey: string) =>
    request<ShiftAck>(`/api/cash/shifts/${enc(shiftId)}/count`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  approveClose: (shiftId: string, input: ApproveCloseInput, idempotencyKey: string) =>
    request<CashClosing>(`/api/cash/shifts/${enc(shiftId)}/approve`, {
      method: 'POST',
      body: { decision: 'APROBAR', ...input },
      idempotencyKey,
    }),

  getClosing: async (shiftId: string) =>
    (await request<{ closing: CashClosing }>(`/api/cash/shifts/${enc(shiftId)}/closing`)).closing,
};
