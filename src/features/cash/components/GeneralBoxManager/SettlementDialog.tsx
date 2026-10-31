'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { getPaymentLabel } from '@/features/payment-methods/helpers/payment-methods.helpers';
import type { Money } from '@/lib/shared/money';
import type { PaymentMethodConfig } from '@/types';

import { accountLabel, bankAccounts, datafonoMethods } from '../../helpers/approvals.helpers';
import { validateSettlement } from '../../helpers/cash-forms.helpers';
import { useLedgerAccounts } from '../../hooks/useCashQueries';
import { useGeneralBoxActions } from '../../hooks/useGeneralBoxActions';
import { MoneyInput } from '../MoneyInput';

interface SettlementDialogProps {
  restaurantId: string;
  paymentMethods: PaymentMethodConfig[] | undefined;
  onClose: () => void;
}

/** Liquidación del datáfono: el banco abonó un lote (lo cobrado por tarjeta llega a la cuenta). */
export function SettlementDialog({ restaurantId, paymentMethods, onClose }: SettlementDialogProps) {
  const { settle } = useGeneralBoxActions(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const methods = datafonoMethods(paymentMethods);
  const [paymentMethodId, setPaymentMethodId] = useState(methods[0]?.id ?? '');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState<Money | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [accountingDate, setAccountingDate] = useState('');
  const [touched, setTouched] = useState(false);
  const { errors, valid } = validateSettlement({
    paymentMethodId,
    bankAccountId,
    amount,
    externalRef,
    accountingDate,
  });

  async function submit() {
    setTouched(true);
    if (!valid || amount === null || settle.isPending) return;
    const result = await settle.run({
      paymentMethodId,
      bankAccountId,
      amount,
      externalRef: externalRef.trim(),
      ...(accountingDate ? { accountingDate } : {}),
    });
    if (result.ok) onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title="Liquidación de datáfono" size="sm">
      <div className="space-y-4 p-6">
        {methods.length === 0 ? (
          <p className="text-sm text-[var(--t-text-3)]">
            No hay un medio de pago de tipo datáfono activo.
          </p>
        ) : (
          <>
            <Select
              label="Medio de pago"
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              error={touched ? errors.paymentMethodId : undefined}
              options={methods.map((m) => ({ value: m.id, label: getPaymentLabel(m) }))}
            />
            <Select
              label="Cuenta bancaria"
              value={bankAccountId}
              onChange={setBankAccountId}
              error={touched ? errors.bankAccountId : undefined}
              options={bankAccounts(accounts.data ?? []).map((a) => ({
                value: a.id,
                label: accountLabel(a),
              }))}
              searchable
            />
            <MoneyInput
              id="settlement-amount"
              label="Monto liquidado"
              value={amount}
              onChange={setAmount}
              error={touched ? errors.amount : undefined}
            />
            <Input
              label="Referencia del lote"
              value={externalRef}
              maxLength={80}
              onChange={(e) => setExternalRef(e.target.value)}
              error={touched ? errors.externalRef : undefined}
            />
            <Input
              label="Fecha contable (opcional)"
              type="date"
              value={accountingDate}
              onChange={(e) => setAccountingDate(e.target.value)}
              error={touched ? errors.accountingDate : undefined}
              hint="Si la dejás vacía se usa la fecha de hoy en Bogotá."
            />
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={settle.isPending} disabled={methods.length === 0}>
            Registrar liquidación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
