'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/features/auth';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import {
  accountLabel,
  cashierLabel,
  DIFFERENCE_LABELS,
  differenceTone,
  isOwnShift,
  postableAccounts,
} from '../../helpers/approvals.helpers';
import { methodTypeLabel } from '../../helpers/shift.helpers';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useClosing, useLedgerAccounts } from '../../hooks/useCashQueries';
import { CashNotice } from '../CashLayout';

import { closingRows } from './closing.helpers';
import type { ClosingDetailModalProps } from './ClosingDetailModal.types';

const TONE_CLASS = {
  ok: 'text-[var(--t-text-2)]',
  surplus: 'text-emerald-600',
  shortage: 'text-red-500',
};
const NOTE_MIN = 5;

/** Detalle del cierre para el supervisor: esperado vs contado por medio, diferencia y aprobación. */
export function ClosingDetailModal({
  restaurantId,
  shift,
  registerName,
  onClose,
}: ClosingDetailModalProps) {
  const { user } = useAuth();
  const closingQuery = useClosing(restaurantId, shift.id);
  const accounts = useLedgerAccounts(restaurantId);
  const { approveClose } = useApprovalActions(restaurantId);
  const [note, setNote] = useState('');
  const [shortageAccountId, setShortageAccountId] = useState('');
  const closing = closingQuery.data;
  const own = isOwnShift(user?.uid, shift);
  const noteError =
    note.trim().length < NOTE_MIN ? `Escribí una nota (mínimo ${NOTE_MIN} caracteres)` : undefined;
  const canApprove = !own && closing?.status === 'PENDIENTE_APROBACION';

  async function approve() {
    if (!closing || noteError || approveClose.isPending) return;
    const result = await approveClose.run({
      shiftId: shift.id,
      input: { note: note.trim(), ...(shortageAccountId ? { shortageAccountId } : {}) },
    });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Cierre de ${registerName}`}
      description={`${cashierLabel(shift.cashierUid, user?.uid)} · abierto ${formatBogotaDateTime(shift.openedAt)}`}
      size="lg"
    >
      <div className="space-y-5 p-6">
        {closingQuery.isLoading && <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>}
        {closingQuery.isError && (
          <CashNotice tone="danger">No se pudo cargar el cierre.</CashNotice>
        )}
        {closing && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-text-3)]">
                  <th className="py-2 font-semibold">Medio</th>
                  <th className="py-2 text-right font-semibold">Esperado</th>
                  <th className="py-2 text-right font-semibold">Contado</th>
                  <th className="py-2 text-right font-semibold">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--t-border)]">
                {closingRows(closing).map((row) => {
                  const tone = differenceTone(row.difference);
                  return (
                    <tr key={row.methodType} className="text-[var(--t-text-1)]">
                      <td className="py-2">{methodTypeLabel(row.methodType)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCOP(row.expected)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCOP(row.declared)}</td>
                      <td
                        className={`py-2 text-right font-semibold tabular-nums ${TONE_CLASS[tone]}`}
                      >
                        {formatCOP(Math.abs(row.difference))}
                        {tone !== 'ok' && (
                          <span className="ml-1 text-xs">({DIFFERENCE_LABELS[tone]})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-[var(--t-text-3)]">
              Diferencia tolerada sin aprobación: {formatCOP(closing.diffThreshold)}
            </p>
            {closing.justification && (
              <div>
                <p className="text-xs font-semibold text-[var(--t-text-2)]">
                  Justificación del cajero
                </p>
                <p className="mt-0.5 text-sm text-[var(--t-text-1)]">{closing.justification}</p>
              </div>
            )}

            {closing.status === 'CERRADO' && closing.approval && (
              <CashNotice tone="success" title="Cierre aprobado">
                {closing.approval.note}
              </CashNotice>
            )}

            {own && closing.status === 'PENDIENTE_APROBACION' && (
              <CashNotice tone="warning" title="No podés aprobar tu propio cierre">
                Otro supervisor debe revisarlo y aprobarlo.
              </CashNotice>
            )}

            {canApprove && (
              <div className="space-y-3 border-t border-[var(--t-border)] pt-4">
                <Textarea
                  label="Nota de aprobación"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  error={note.length > 0 ? noteError : undefined}
                />
                {closing.cashDifference < 0 && (
                  <Select
                    label="Cuenta del faltante (opcional)"
                    value={shortageAccountId}
                    onChange={setShortageAccountId}
                    placeholder="Usar la cuenta por defecto"
                    hint={
                      accounts.isError ? 'No tenés permiso para ver el plan de cuentas' : undefined
                    }
                    options={postableAccounts(accounts.data ?? []).map((a) => ({
                      value: a.id,
                      label: accountLabel(a),
                    }))}
                    searchable
                  />
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={approve}
                    isLoading={approveClose.isPending}
                    disabled={!!noteError}
                  >
                    Aprobar cierre
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
