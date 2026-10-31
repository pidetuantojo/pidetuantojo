'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

import { REASON_MAX, reasonError } from '../../helpers/reason.helpers';

import type { ReasonDialogProps } from './ReasonDialog.types';

/** Pide un motivo (5-500 caracteres) antes de reversar un movimiento o rechazar un retiro. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error = reasonError(reason);

  function submit() {
    setTouched(true);
    if (!error && !isPending) onConfirm(reason.trim());
  }

  return (
    <Modal isOpen onClose={onClose} title={title} description={description} size="sm">
      <div className="space-y-4 p-6">
        <Textarea
          label="Motivo"
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? (error ?? undefined) : undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} isLoading={isPending} disabled={!!error}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
