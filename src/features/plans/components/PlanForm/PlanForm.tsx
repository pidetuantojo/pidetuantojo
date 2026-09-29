'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PermissionsEditor } from '@/components/permissions/PermissionsEditor';
import type { Permission } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { ALL_PERMISSIONS, normalizePermissions } from '@/lib/permissions/permissions';
import type { SavePlanData } from '@/types';

import { usePlan, useSavePlan } from '../../hooks/usePlans';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

const EMPTY: SavePlanData = {
  name: '', description: '', price: 0, billingPeriod: 'monthly', permissions: [],
  isActive: true, sortOrder: 1, limits: {},
};

/** Crear / editar un plan (super admin). Al guardar, recalcula permisos de los restaurantes que lo usan. */
export function PlanForm({ planId }: { planId?: string }) {
  const router = useRouter();
  const { data: plan, isLoading } = usePlan(planId);
  const save = useSavePlan();
  const [form, setForm] = useState<SavePlanData>(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!plan) return;
    setForm({
      name: plan.name, description: plan.description ?? '', price: plan.price, billingPeriod: plan.billingPeriod,
      permissions: normalizePermissions(plan.permissions), isActive: plan.isActive, sortOrder: plan.sortOrder,
      limits: plan.limits ?? {},
    });
  }, [plan]);

  const set = <K extends keyof SavePlanData>(key: K, value: SavePlanData[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setError('');
    setNotice('');
    if (!form.name.trim()) { setError('El nombre del plan es obligatorio'); return; }
    if (form.price < 0) { setError('El precio no puede ser negativo'); return; }
    if (normalizePermissions(form.permissions).length === 0) { setError('Selecciona al menos un permiso'); return; }
    try {
      const { planId: savedId, synced } = await save.mutateAsync({ id: planId, data: form });
      if (!planId) {
        router.replace(ROUTES.admin.plan(savedId));
        return;
      }
      setNotice(synced.restaurants
        ? `Guardado. Permisos actualizados en ${synced.restaurants} restaurante(s) y ${synced.users} usuario(s).`
        : 'Guardado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el plan');
    }
  }

  if (planId && isLoading) return <p style={{ fontFamily: sg, color: 'var(--t-text-3)' }}>Cargando plan…</p>;
  if (planId && !isLoading && !plan) return <p style={{ fontFamily: sg, color: '#b91c1c' }}>El plan no existe.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: sg, maxWidth: 900 }}>
      <div>
        <Link href={ROUTES.admin.plans} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-3)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Planes
        </Link>
        <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
          {planId ? `Editar plan: ${plan?.name ?? ''}` : 'Nuevo plan'}
        </h2>
      </div>

      <section style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Field label="Nombre *">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Básico, Pro, Completo" style={input} />
          </Field>
          <Field label="Precio (COP)">
            <input type="number" min={0} step={1000} value={form.price} onChange={(e) => set('price', Number(e.target.value) || 0)} style={input} />
          </Field>
          <Field label="Periodo">
            <select value={form.billingPeriod} onChange={(e) => set('billingPeriod', e.target.value as SavePlanData['billingPeriod'])} style={input}>
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </Field>
          <Field label="Orden en el listado">
            <input type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} style={input} />
          </Field>
          <Field label="Máx. empleados (opcional)">
            <input
              type="number" min={0} placeholder="Sin límite"
              value={form.limits?.maxEmployees ?? ''}
              onChange={(e) => set('limits', e.target.value ? { maxEmployees: Number(e.target.value) } : {})}
              style={input}
            />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Qué incluye este plan (se muestra al asignarlo)" style={{ ...input, resize: 'vertical' }} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-1)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ width: 16, height: 16, accentColor: ORANGE }} />
          Plan activo (se puede asignar a restaurantes)
        </label>
      </section>

      <section style={card}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--t-text-1)' }}>Permisos y funcionalidades</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>
            El administrador del restaurante recibe todos estos permisos y puede repartirlos entre sus empleados.
            Las dependencias se marcan solas (ej. editar productos incluye ver productos).
          </p>
        </div>
        <PermissionsEditor
          value={form.permissions as Permission[]}
          onChange={(next) => set('permissions', next)}
          available={ALL_PERMISSIONS}
          showFeatures
        />
      </section>

      {error && <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>{error}</div>}
      {notice && <div role="status" style={{ fontSize: 13, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px' }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 10, position: 'sticky', bottom: 12 }}>
        <Link href={ROUTES.admin.plans} style={{ padding: '12px 20px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
          Cancelar
        </Link>
        <button type="button" onClick={handleSave} disabled={save.isPending} style={{ padding: '12px 24px', borderRadius: 999, border: 'none', background: ORANGE, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: save.isPending ? 0.7 : 1 }}>
          {save.isPending ? 'Guardando…' : planId ? 'Guardar cambios' : 'Crear plan'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: 'var(--t-surface)', border: '1.5px solid var(--t-border-2)', borderRadius: 18, padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 14,
};
const input: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10,
  padding: '10px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box',
};
