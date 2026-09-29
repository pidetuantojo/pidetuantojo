'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Checkbox } from '@/components/ui/Checkbox';
import { PermissionsEditor } from '@/components/permissions/PermissionsEditor';
import type { Permission } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { ALL_PERMISSIONS, FEATURE_PERMISSIONS, normalizePermissions, sortPermissions } from '@/lib/permissions/permissions';
import type { SavePlanData } from '@/types';

import { useToastStore } from '@/store/toast.store';

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
  const { showToast } = useToastStore();
  const [form, setForm] = useState<SavePlanData>(EMPTY);
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (!plan) return;
    setForm({
      name: plan.name, description: plan.description ?? '', price: plan.price, billingPeriod: plan.billingPeriod,
      permissions: normalizePermissions(plan.permissions), isActive: plan.isActive, sortOrder: plan.sortOrder,
      limits: plan.limits ?? {},
    });
    setPriceStr(plan.price > 0 ? String(plan.price) : '');
  }, [plan]);

  const set = <K extends keyof SavePlanData>(key: K, value: SavePlanData[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    if (!form.name.trim()) { showToast('El nombre del plan es obligatorio', 'error'); return; }
    if (form.price < 0) { showToast('El precio no puede ser negativo', 'error'); return; }
    if (normalizePermissions(form.permissions).length === 0) { showToast('Selecciona al menos un permiso', 'error'); return; }
    try {
      const finalPermissions = sortPermissions(Array.from(new Set([...normalizePermissions(form.permissions), ...FEATURE_PERMISSIONS])));
      const { synced } = await save.mutateAsync({ id: planId, data: { ...form, permissions: finalPermissions } });
      if (!planId) {
        showToast(`Plan "${form.name.trim()}" creado`);
        router.replace(ROUTES.admin.plans);
        return;
      }
      showToast(synced.restaurants
        ? `Guardado. Permisos actualizados en ${synced.restaurants} restaurante(s) y ${synced.users} usuario(s).`
        : `Plan "${form.name.trim()}" guardado`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar el plan', 'error');
    }
  }

  if (planId && isLoading) return <p style={{ fontFamily: sg, color: 'var(--t-text-3)' }}>Cargando plan…</p>;
  if (planId && !isLoading && !plan) return <p style={{ fontFamily: sg, color: '#b91c1c' }}>El plan no existe.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: sg, maxWidth: 900, margin: '0 auto' }}>
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 12, fontWeight: 700, fontSize: 14, color: 'var(--t-text-2)', pointerEvents: 'none', userSelect: 'none' }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceStr}
                placeholder="0"
                style={{ ...input, paddingLeft: 26 }}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                  setPriceStr(raw);
                  set('price', raw ? Number(raw) : 0);
                }}
                onFocus={() => {
                  setPriceStr(form.price > 0 ? String(form.price) : '');
                }}
                onBlur={() => {
                  const val = form.price > 0 ? form.price : 0;
                  set('price', val);
                  setPriceStr(val > 0 ? val.toLocaleString('es-CO') : '');
                }}
              />
            </div>
          </Field>
          <Field label="Periodo">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['monthly', 'yearly'] as const).map((period) => {
                const active = form.billingPeriod === period;
                return (
                  <label
                    key={period}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${active ? ORANGE : 'var(--t-border-2)'}`,
                      background: active ? 'rgba(255,106,26,.08)' : 'var(--t-input-bg)',
                      fontSize: 14, fontWeight: active ? 700 : 400,
                      color: active ? ORANGE : 'var(--t-text-2)',
                      transition: 'all .15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="billingPeriod"
                      value={period}
                      checked={active}
                      onChange={() => set('billingPeriod', period)}
                      style={{ display: 'none' }}
                    />
                    {period === 'monthly' ? 'Mensual' : 'Anual'}
                  </label>
                );
              })}
            </div>
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
          <Checkbox checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
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
        />
      </section>


      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 12, padding: '14px 0', zIndex: 10 }}>
        <Link
          href={ROUTES.admin.plans}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '13px 20px', borderRadius: 999, border: 'none',
            background: '#f3f4f6', color: '#374151',
            fontFamily: sg, fontWeight: 600, fontSize: 14, textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px 20px', borderRadius: 999, border: 'none',
            background: ORANGE, color: '#fff',
            fontFamily: sg, fontWeight: 700, fontSize: 14,
            cursor: save.isPending ? 'not-allowed' : 'pointer',
            opacity: save.isPending ? 0.75 : 1,
            boxShadow: '0 2px 8px rgba(251,114,26,0.35)',
          }}
        >
          {save.isPending && (
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
          )}
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
