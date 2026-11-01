'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatBogotaDateTime } from '@/lib/shared/bogotaDate';
import { formatCOP } from '@/lib/shared/money';

import {
  canApproveReimbursement,
  REIMBURSEMENT_STATUS_LABELS,
} from '../../helpers/petty-forms.helpers';
import { useLedgerAccounts, useRegisters } from '../../hooks/useCashQueries';
import { useFundSourceDraft } from '../../hooks/useFundSourceDraft';
import { usePettyReimbursementActions } from '../../hooks/usePettyActions';
import { usePettyReimbursements } from '../../hooks/usePettyQueries';
import type { ReimbursementRow, ReimbursementStatus } from '../../types/cash.petty.types';
import { CashCard, CashNotice } from '../CashLayout';
import { ReasonDialog } from '../ReasonDialog';

import { FundSourceFields } from './FundSourceFields';

const STATUS_VARIANT = {
  PENDIENTE_APROBACION: 'warning',
  APROBADO: 'success',
  RECHAZADO: 'danger',
} as const satisfies Record<ReimbursementStatus, string>;

interface ApproveDialogProps {
  restaurantId: string;
  reimbursement: ReimbursementRow;
  defaultGeneralId?: string;
  onClose: () => void;
}

function ApproveDialog({
  restaurantId,
  reimbursement,
  defaultGeneralId,
  onClose,
}: ApproveDialogProps) {
  const { approve } = usePettyReimbursementActions(restaurantId);
  const registers = useRegisters(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const source = useFundSourceDraft(defaultGeneralId);

  async function submit() {
    if (!source.source || approve.isPending) return;
    const result = await approve.run({ id: reimbursement.id, source: source.source });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Aprobar reembolso"
      description={`Se repone el fondo con ${formatCOP(reimbursement.total)} y el gasto queda en contabilidad.`}
      size="sm"
    >
      <div className="space-y-4 p-6">
        <FundSourceFields
          draft={source}
          registers={registers.data ?? []}
          accounts={accounts.data ?? []}
          accountsDenied={accounts.isError}
          label="Repone desde"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={approve.isPending} disabled={!source.source}>
            Aprobar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface ReimbursementsCardProps {
  restaurantId: string;
  registerId: string;
  uid: string | undefined;
  canApprove: boolean;
  defaultGeneralId?: string;
}

/** Reembolsos solicitados; quien aprueba decide (nunca sobre lo que él mismo solicitó). */
export function ReimbursementsCard({
  restaurantId,
  registerId,
  uid,
  canApprove,
  defaultGeneralId,
}: ReimbursementsCardProps) {
  const list = usePettyReimbursements(restaurantId, registerId);
  const { reject } = usePettyReimbursementActions(restaurantId);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const rows = list.data ?? [];
  const approvingRow = rows.find((r) => r.id === approving);

  return (
    <CashCard title="Reembolsos">
      {list.isError ? (
        <CashNotice tone="danger">No se pudieron cargar los reembolsos.</CashNotice>
      ) : list.isLoading ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">No hay reembolsos.</p>
      ) : (
        <ul className="divide-y divide-[var(--t-border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--t-text-1)]">
                  {formatCOP(r.total)} · {r.expenseIds.length}{' '}
                  {r.expenseIds.length === 1 ? 'gasto' : 'gastos'}
                </p>
                <p className="text-xs text-[var(--t-text-3)]">
                  Solicitado {formatBogotaDateTime(r.requestedAt)}
                  {r.requestedBy === uid ? ' · por vos' : ''}
                </p>
                {r.decisionNote && (
                  <p className="text-xs text-[var(--t-text-3)]">Motivo: {r.decisionNote}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[r.status]}>
                {REIMBURSEMENT_STATUS_LABELS[r.status]}
              </Badge>
              {canApproveReimbursement(r, uid, canApprove) && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setApproving(r.id)}>
                    Aprobar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRejecting(r.id)}>
                    Rechazar
                  </Button>
                </div>
              )}
              {canApprove && r.status === 'PENDIENTE_APROBACION' && r.requestedBy === uid && (
                <span className="text-xs text-[var(--t-text-3)]">Otra persona debe aprobarlo</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {approvingRow && (
        <ApproveDialog
          restaurantId={restaurantId}
          reimbursement={approvingRow}
          defaultGeneralId={defaultGeneralId}
          onClose={() => setApproving(null)}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title="Rechazar reembolso"
          description="Los gastos quedan legalizados y disponibles para otra solicitud."
          confirmLabel="Rechazar"
          isPending={reject.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={async (note) => {
            const result = await reject.run({ id: rejecting, note });
            if (result.ok) setRejecting(null);
          }}
        />
      )}
    </CashCard>
  );
}
