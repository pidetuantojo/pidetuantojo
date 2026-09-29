'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { formatCurrency } from '@/lib/utils';
import { FEATURE_PERMISSIONS, USER_PERMISSIONS, normalizePermissions } from '@/lib/permissions/permissions';
import { useRestaurants } from '@/features/restaurants/hooks/useRestaurants';
import type { Plan } from '@/types';

import { useDeletePlan, usePlans, useSavePlan, useSetPlanActive } from '../../hooks/usePlans';
import { plansService } from '../../services/plans.service';
import { MigrationPanel } from '../MigrationPanel';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

/** Listado de planes (super admin): crear, editar, duplicar, activar/desactivar y eliminar. */
export function PlansManager() {
  const { data: plans = [], isLoading, error } = usePlans();
  const { data: restaurants = [] } = useRestaurants();
  const savePlan = useSavePlan();
  const setActive = useSetPlanActive();
  const deletePlan = useDeletePlan();
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  // Restaurantes por plan (y sin plan)
  const usage = useMemo(() => {
    const counts: Record<string, number> = {};
    restaurants.forEach((r) => { const k = r.planId ?? '__none__'; counts[k] = (counts[k] ?? 0) + 1; });
    return counts;
  }, [restaurants]);

  async function run(fn: () => Promise<unknown>) {
    setActionError('');
    setNotice('');
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
  }

  function duplicate(plan: Plan) {
    return run(() => savePlan.mutateAsync({
      data: {
        name: `${plan.name} (copia)`, description: plan.description, price: plan.price,
        billingPeriod: plan.billingPeriod, permissions: plan.permissions, isActive: false,
        sortOrder: plan.sortOrder + 1, limits: plan.limits ?? {},
      },
    }));
  }

  function remove(plan: Plan) {
    if (!confirm(`¿Eliminar el plan "${plan.name}"?`)) return;
    return run(() => deletePlan.mutateAsync(plan.id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: sg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>Planes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
            Define qué módulos y acciones incluye cada plan. Cada restaurante tiene un plan; su administrador recibe todos sus permisos.
          </p>
        </div>
        <Link href={ROUTES.admin.planNew} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, background: ORANGE, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          <Plus size={16} /> Nuevo plan
        </Link>
      </div>

      {(usage.__none__ ?? 0) > 0 && (
        <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px' }}>
          {usage.__none__} restaurante(s) todavía no tienen plan: conservan acceso completo hasta que les asignes uno
          (o hasta correr la migración de abajo).
        </div>
      )}
      {notice && <div role="status" style={{ fontSize: 13, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px' }}>{notice}</div>}
      {actionError && <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>{actionError}</div>}
      {error && <div role="alert" style={{ fontSize: 13, color: '#b91c1c' }}>Error al cargar los planes.</div>}

      {isLoading ? (
        <p style={{ color: 'var(--t-text-3)', fontSize: 14 }}>Cargando planes…</p>
      ) : plans.length === 0 ? (
        <div style={{ border: '2px dashed var(--t-border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', background: 'var(--t-surface-2)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)', margin: '0 0 6px' }}>Todavía no hay planes</p>
          <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>Crea el primero para asignarlo a tus restaurantes.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {plans.map((plan) => {
            const perms = normalizePermissions(plan.permissions);
            const userCount = perms.filter((p) => !p.startsWith('features.')).length;
            const featureCount = perms.filter((p) => p.startsWith('features.')).length;
            const inUse = usage[plan.id] ?? 0;
            return (
              <div key={plan.id} style={{ background: 'var(--t-surface)', border: `1.5px solid ${plan.isActive ? `${ORANGE}44` : 'var(--t-border-2)'}`, borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, opacity: plan.isActive ? 1 : 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 17, color: 'var(--t-text-1)' }}>{plan.name}</span>
                  <span style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: plan.isActive ? '#d1fae5' : 'var(--t-surface-2)', color: plan.isActive ? '#059669' : 'var(--t-text-3)' }}>
                    {plan.isActive ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ORANGE }}>
                  {formatCurrency(plan.price)}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-3)' }}> / {plan.billingPeriod === 'yearly' ? 'año' : 'mes'}</span>
                </div>
                {plan.description && <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)' }}>{plan.description}</p>}
                <div style={{ fontSize: 12, color: 'var(--t-text-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{userCount} de {USER_PERMISSIONS.length} permisos · {featureCount} de {FEATURE_PERMISSIONS.length} funcionalidades</span>
                  <span>{inUse} restaurante(s) con este plan{plan.limits?.maxEmployees ? ` · máx. ${plan.limits.maxEmployees} empleados` : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <Link href={ROUTES.admin.plan(plan.id)} style={action}><Pencil size={13} /> Editar</Link>
                  <button type="button" onClick={() => duplicate(plan)} style={action}><Copy size={13} /> Duplicar</button>
                  {inUse > 0 && (
                    <button
                      type="button"
                      title="Recalcula los permisos del admin y empleados de los restaurantes con este plan"
                      onClick={() => run(async () => {
                        const r = await plansService.sync({ planId: plan.id });
                        setNotice(`"${plan.name}": permisos actualizados en ${r.restaurants} restaurante(s) y ${r.users} usuario(s).`);
                      })}
                      style={action}
                    >
                      <RefreshCw size={13} /> Resincronizar
                    </button>
                  )}
                  <button type="button" onClick={() => run(() => setActive.mutateAsync({ id: plan.id, isActive: !plan.isActive }))} style={action}>
                    {plan.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" onClick={() => remove(plan)} disabled={inUse > 0} title={inUse > 0 ? 'Tiene restaurantes asignados' : 'Eliminar'} style={{ ...action, opacity: inUse > 0 ? 0.4 : 1 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MigrationPanel />
    </div>
  );
}

const action: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
  border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)',
  fontFamily: sg, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
};
