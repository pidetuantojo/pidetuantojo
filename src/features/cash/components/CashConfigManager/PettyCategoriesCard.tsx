'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

import { accountLabel, expenseAccounts } from '../../helpers/approvals.helpers';
import { useLedgerAccounts } from '../../hooks/useCashQueries';
import { usePettyCategoryActions } from '../../hooks/usePettyActions';
import { usePettyCategories } from '../../hooks/usePettyQueries';
import type { PettyCategory } from '../../types/cash.petty.types';
import type { LedgerAccount } from '../../types/cash.types';
import { CashCard, CashNotice } from '../CashLayout';

interface CategoryFormDialogProps {
  restaurantId: string;
  category?: PettyCategory;
  accounts: readonly LedgerAccount[];
  onClose: () => void;
}

function CategoryFormDialog({
  restaurantId,
  category,
  accounts,
  onClose,
}: CategoryFormDialogProps) {
  const { create, update } = usePettyCategoryActions(restaurantId);
  const [name, setName] = useState(category?.name ?? '');
  const [ledgerAccountId, setLedgerAccountId] = useState(category?.ledgerAccountId ?? '');
  const [touched, setTouched] = useState(false);
  const nameError = name.trim().length < 2 ? 'Escribí el nombre' : undefined;
  const accountError = ledgerAccountId ? undefined : 'Elegí la cuenta de gasto';
  const pending = create.isPending || update.isPending;

  async function submit() {
    setTouched(true);
    if (nameError || accountError || pending) return;
    const input = { name: name.trim(), ledgerAccountId };
    const result = category
      ? await update.run({ id: category.id, input })
      : await create.run(input);
    if (result.ok) onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      size="sm"
    >
      <div className="space-y-4 p-6">
        <Input
          label="Nombre"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={touched ? nameError : undefined}
        />
        <Select
          label="Cuenta de gasto"
          value={ledgerAccountId}
          onChange={setLedgerAccountId}
          error={touched ? accountError : undefined}
          options={expenseAccounts(accounts).map((a) => ({ value: a.id, label: accountLabel(a) }))}
          searchable
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={pending}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Categorías de gasto de la caja menor: cada una apunta a su cuenta de gasto. */
export function PettyCategoriesCard({ restaurantId }: { restaurantId: string }) {
  const categories = usePettyCategories(restaurantId);
  const accounts = useLedgerAccounts(restaurantId);
  const { update } = usePettyCategoryActions(restaurantId);
  const [editing, setEditing] = useState<PettyCategory | 'new' | null>(null);

  const accountName = (id: string) => {
    const account = accounts.data?.find((a) => a.id === id);
    return account ? accountLabel(account) : id;
  };

  return (
    <CashCard
      title="Categorías de caja menor"
      description="Al reembolsar, cada gasto se contabiliza en la cuenta de su categoría"
      actions={
        <Button size="sm" onClick={() => setEditing('new')} disabled={accounts.isError}>
          Nueva categoría
        </Button>
      }
    >
      {accounts.isError && (
        <div className="mb-3">
          <CashNotice tone="warning">
            Necesitás permiso para ver el plan de cuentas para crear o editar categorías.
          </CashNotice>
        </div>
      )}
      {categories.isLoading ? (
        <p className="text-sm text-[var(--t-text-3)]">Cargando...</p>
      ) : (categories.data ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--t-text-3)]">
          Todavía no hay categorías.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--t-border)]">
          {categories.data?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="flex-1 font-medium text-[var(--t-text-1)]">{c.name}</span>
              <span className="text-[var(--t-text-2)]">{accountName(c.ledgerAccountId)}</span>
              <Badge variant={c.isActive ? 'success' : 'default'}>
                {c.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF6A1A] hover:underline"
                onClick={() => setEditing(c)}
              >
                Editar
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-[var(--t-text-2)] hover:underline"
                onClick={() => update.run({ id: c.id, input: { isActive: !c.isActive } })}
              >
                {c.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CategoryFormDialog
          restaurantId={restaurantId}
          category={editing === 'new' ? undefined : editing}
          accounts={accounts.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </CashCard>
  );
}
