import { NextResponse } from 'next/server';

import { requireLedgerAccess } from '@/lib/ledger/access.server';
import { ledgerErrorResponse } from '@/lib/ledger/api.server';
import { setupLedger } from '@/lib/ledger/setup.server';
import { buildAuditContext } from '@/lib/shared/audit.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Siembra el plan de cuentas y las reglas por defecto. Idempotente: si ya existen, no hace nada.
export async function POST(request: Request) {
  try {
    const { caller, restaurantId } = await requireLedgerAccess(request, 'ledger.manage');
    const result = await setupLedger(restaurantId, buildAuditContext(request, caller));
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return ledgerErrorResponse(error, 'ledger/setup');
  }
}
