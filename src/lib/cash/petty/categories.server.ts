// SOLO servidor: categorías de la caja menor (nombre + cuenta de gasto). No se borran: se desactivan.
import type { DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { isPostable } from '@/lib/ledger/accounts.helpers';
import type { MutationMeta } from '@/lib/ledger/accounts.server';
import { stripUndefined } from '@/lib/ledger/ledger.paths';
import { writeAuditLog } from '@/lib/shared/audit.server';
import { checkIdempotency } from '@/lib/shared/idempotency.server';

import { CashError } from '../cash.errors';
import { readLedgerAccount } from '../general.server';
import { pettyCollectionPath, pettyDocPath } from './petty.paths';
import { readCategory } from './petty.read.server';
import type { PettyCategory } from './petty.types';

export interface CategoryInput {
  name: string;
  ledgerAccountId: string;
}

export interface UpdateCategoryInput {
  name?: string;
  ledgerAccountId?: string;
  isActive?: boolean;
}

export async function listCategories(restaurantId: string): Promise<PettyCategory[]> {
  const snap = await adminDb.collection(pettyCollectionPath(restaurantId, 'categories')).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as PettyCategory), id: d.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function assertExpenseAccount(
  tx: Parameters<typeof readLedgerAccount>[0],
  restaurantId: string,
  accountId: string
) {
  const account = await readLedgerAccount(tx, restaurantId, accountId);
  if ((account.class !== 'GASTO' && account.class !== 'COSTO') || !isPostable(account)) {
    throw new CashError(
      'INVALID_LEDGER_ACCOUNT',
      'La cuenta debe ser de gasto o costo, activa y que admita movimientos'
    );
  }
}

export async function createCategory(
  restaurantId: string,
  input: CategoryInput,
  meta: MutationMeta
): Promise<PettyCategory> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyCategory>(tx, {
      restaurantId,
      scope: 'cash.petty.category.create',
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    await assertExpenseAccount(tx, restaurantId, input.ledgerAccountId);
    const ref = adminDb.collection(pettyCollectionPath(restaurantId, 'categories')).doc();
    const category: PettyCategory = {
      id: ref.id,
      name: input.name,
      ledgerAccountId: input.ledgerAccountId,
      isActive: true,
      createdAt: audit.at,
      updatedAt: audit.at,
    };
    tx.create(ref as DocumentReference, category);
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.category_created',
      entityType: 'pettyCashCategory',
      entityId: ref.id,
      context: audit,
    });
    idem.save(tx, category);
    return category;
  });
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  input: UpdateCategoryInput,
  meta: MutationMeta
): Promise<PettyCategory> {
  const { audit } = meta;
  return adminDb.runTransaction(async (tx) => {
    const idem = await checkIdempotency<PettyCategory>(tx, {
      restaurantId,
      scope: `cash.petty.category.update:${categoryId}`,
      key: meta.idempotencyKey,
      uid: audit.uid,
      payload: input,
    });
    if (idem.status === 'replay') return idem.result;

    const current = await readCategory(tx, restaurantId, categoryId);
    if (input.ledgerAccountId && input.ledgerAccountId !== current.ledgerAccountId) {
      await assertExpenseAccount(tx, restaurantId, input.ledgerAccountId);
    }
    const updated: PettyCategory = { ...current, ...stripUndefined(input), updatedAt: audit.at };
    tx.update(
      adminDb.doc(pettyDocPath(restaurantId, 'categories', categoryId)) as DocumentReference,
      stripUndefined({ ...input, updatedAt: audit.at })
    );
    writeAuditLog(tx, restaurantId, {
      action: 'cash.petty.category_updated',
      entityType: 'pettyCashCategory',
      entityId: categoryId,
      context: audit,
      data: { fields: Object.keys(input) },
    });
    idem.save(tx, updated);
    return updated;
  });
}
