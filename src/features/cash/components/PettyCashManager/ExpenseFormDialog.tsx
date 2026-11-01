'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { formatCOP, type Money } from '@/lib/shared/money';

import { todayBogota, validateExpense } from '../../helpers/petty-forms.helpers';
import { usePettyExpenseActions } from '../../hooks/usePettyActions';
import { usePettyCategories } from '../../hooks/usePettyQueries';
import type { PettyAttachment } from '../../types/cash.petty.types';
import { AttachmentUpload } from '../AttachmentUpload';
import { MoneyInput } from '../MoneyInput';

interface ExpenseFormDialogProps {
  restaurantId: string;
  registerId: string;
  maxExpense: number;
  cashOnHand: number;
  onClose: () => void;
}

/** Registrar un gasto (vale) de la caja menor. */
export function ExpenseFormDialog({
  restaurantId,
  registerId,
  maxExpense,
  cashOnHand,
  onClose,
}: ExpenseFormDialogProps) {
  const { create } = usePettyExpenseActions(restaurantId);
  const categories = usePettyCategories(restaurantId);
  const [amount, setAmount] = useState<Money | null>(null);
  const [concept, setConcept] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyDocument, setThirdPartyDocument] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayBogota());
  const [attachments, setAttachments] = useState<PettyAttachment[]>([]);
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateExpense({
    amount,
    maxExpense,
    concept,
    thirdPartyName,
    thirdPartyDocument,
    categoryId,
    date,
  });
  const overCash = amount !== null && amount > cashOnHand;

  async function submit() {
    setTouched(true);
    if (!valid || amount === null || create.isPending) return;
    const document = thirdPartyDocument.trim();
    const result = await create.run({
      registerId,
      concept: concept.trim(),
      thirdPartyName: thirdPartyName.trim(),
      ...(document ? { thirdPartyDocument: document } : {}),
      categoryId,
      amount,
      date,
      attachments,
    });
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Registrar gasto"
      description={`Máximo por gasto ${formatCOP(maxExpense)} · Efectivo disponible ${formatCOP(cashOnHand)}`}
      size="md"
    >
      <div className="space-y-4 p-6">
        <MoneyInput
          id="petty-expense-amount"
          label="Monto"
          value={amount}
          onChange={setAmount}
          error={touched ? errors.amount : overCash ? 'Supera el efectivo de la caja' : undefined}
        />
        <Input
          label="Concepto"
          value={concept}
          maxLength={200}
          onChange={(e) => setConcept(e.target.value)}
          error={touched ? errors.concept : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tercero (nombre)"
            value={thirdPartyName}
            maxLength={120}
            onChange={(e) => setThirdPartyName(e.target.value)}
            error={touched ? errors.thirdPartyName : undefined}
          />
          <Input
            label="Documento (opcional)"
            value={thirdPartyDocument}
            maxLength={30}
            onChange={(e) => setThirdPartyDocument(e.target.value)}
            error={touched ? errors.thirdPartyDocument : undefined}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Categoría"
            value={categoryId}
            onChange={setCategoryId}
            error={touched ? errors.categoryId : undefined}
            hint={
              categories.data && categories.data.length === 0
                ? 'Creá categorías en la configuración de caja'
                : undefined
            }
            options={(categories.data ?? [])
              .filter((c) => c.isActive)
              .map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            label="Fecha del gasto"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={touched ? errors.date : undefined}
          />
        </div>
        <AttachmentUpload
          value={attachments}
          onUploaded={(a) => setAttachments((prev) => [...prev, a])}
          onRemove={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={create.isPending}>
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
