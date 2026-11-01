import { useState } from 'react';

import type { FundSource } from '../types/cash.petty.types';

export type FundSourceKind = 'GENERAL' | 'BANK';

/** Borrador del origen del dinero (caja general o cuenta bancaria) para fondo y reembolsos. */
export function useFundSourceDraft(defaultGeneralId = '') {
  const [kind, setKind] = useState<FundSourceKind>('GENERAL');
  const [generalId, setGeneralId] = useState(defaultGeneralId);
  const [bankAccountId, setBankAccountId] = useState('');

  const source: FundSource | null =
    kind === 'GENERAL'
      ? generalId
        ? { kind: 'GENERAL', registerId: generalId }
        : null
      : bankAccountId
        ? { kind: 'BANK', bankAccountId }
        : null;

  return { kind, setKind, generalId, setGeneralId, bankAccountId, setBankAccountId, source };
}

export type FundSourceDraft = ReturnType<typeof useFundSourceDraft>;
