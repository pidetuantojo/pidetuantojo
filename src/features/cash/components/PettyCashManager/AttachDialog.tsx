'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

import { usePettyExpenseActions } from '../../hooks/usePettyActions';
import type { PettyExpense } from '../../types/cash.petty.types';
import { AttachmentUpload } from '../AttachmentUpload';

interface AttachDialogProps {
  restaurantId: string;
  expense: PettyExpense;
  onClose: () => void;
}

/** Agrega soportes (imagen o PDF) a un gasto que todavía no está en un reembolso. */
export function AttachDialog({ restaurantId, expense, onClose }: AttachDialogProps) {
  const { attach } = usePettyExpenseActions(restaurantId);

  return (
    <Modal isOpen onClose={onClose} title={`Adjuntos del vale ${expense.voucherNumber}`} size="sm">
      <div className="space-y-4 p-6">
        <AttachmentUpload
          value={expense.attachments}
          disabled={attach.isPending}
          onUploaded={async (attachment) => {
            await attach.run({ expenseId: expense.id, attachment });
          }}
        />
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
