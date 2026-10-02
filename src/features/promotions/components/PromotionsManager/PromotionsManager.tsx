'use client';

import { useMemo, useState } from 'react';
import { Copy, Pause, Pencil, Play, Trash2 } from 'lucide-react';

import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useProducts } from '@/features/products/hooks/useProducts';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';
import type { Promotion, SavePromotionData } from '@/types';

import {
  describePromotion, getPromotionStatus, promotionBadge, PROMOTION_STATUS_LABEL, PROMOTION_TYPE_LABEL, type PromotionStatus,
} from '../../engine';
import { duplicatePromotionForm, promotionToForm, type PromotionFormState } from '../../helpers/promotionForm';
import { useNow } from '../../hooks/useNow';
import { useCreatePromotion, useDeletePromotion, usePromotions, useUpdatePromotion } from '../../hooks/usePromotions';
import { LoyaltySettings } from '../LoyaltySettings';
import { PromotionWizard } from '../PromotionWizard';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

const STATUS_STYLE: Record<PromotionStatus, { bg: string; color: string }> = {
  active: { bg: '#d1fae5', color: '#059669' },
  off_hours: { bg: '#e0f2fe', color: '#0369a1' },
  scheduled: { bg: '#ede9fe', color: '#6d28d9' },
  paused: { bg: 'var(--t-surface-2)', color: 'var(--t-text-3)' },
  expired: { bg: '#fee2e2', color: '#b91c1c' },
  exhausted: { bg: '#fef3c7', color: '#b45309' },
};

type Filter = 'all' | 'live' | 'scheduled' | 'paused' | 'ended';
const FILTERS: { id: Filter; label: string; statuses: PromotionStatus[] }[] = [
  { id: 'all', label: 'Todas', statuses: [] },
  { id: 'live', label: 'Activas', statuses: ['active', 'off_hours'] },
  { id: 'scheduled', label: 'Programadas', statuses: ['scheduled'] },
  { id: 'paused', label: 'Pausadas', statuses: ['paused'] },
  { id: 'ended', label: 'Vencidas / agotadas', statuses: ['expired', 'exhausted'] },
];

type WizardState = { mode: 'create'; initial?: PromotionFormState } | { mode: 'edit'; promotion: Promotion } | null;

export function PromotionsManager() {
  const { user, can } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const canManage = can('promotions.manage');
  const advancedEnabled = can('features.promotions_advanced');

  const { data: promotions = [], isLoading, error } = usePromotions(restaurantId || undefined);
  const { data: products = [] } = useProducts(restaurantId);
  const { data: categories = [] } = useCategories(restaurantId);
  const { data: restaurant } = useRestaurant(restaurantId || undefined);
  const createPromotion = useCreatePromotion(restaurantId);
  const updatePromotion = useUpdatePromotion(restaurantId);
  const deletePromotion = useDeletePromotion(restaurantId);
  const { showToast } = useToastStore();
  const { showConfirm } = useConfirmStore();
  const now = useNow(60_000);

  const [wizard, setWizard] = useState<WizardState>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const names = useMemo(() => ({
    products: new Map(products.map((p) => [p.id, p.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
  }), [products, categories]);

  const withStatus = promotions.map((p) => ({ promotion: p, status: getPromotionStatus(p, now) }));
  const statuses = FILTERS.find((f) => f.id === filter)!.statuses;
  const visible = statuses.length ? withStatus.filter((x) => statuses.includes(x.status)) : withStatus;

  async function handleSave(data: SavePromotionData) {
    try {
      if (wizard?.mode === 'edit') {
        await updatePromotion.mutateAsync({ id: wizard.promotion.id, data });
        showToast(`Promoción "${data.name}" actualizada`);
      } else {
        await createPromotion.mutateAsync(data);
        showToast(`Promoción "${data.name}" creada`);
      }
      setWizard(null);
    } catch {
      showToast('No se pudo guardar la promoción', 'error');
    }
  }

  async function toggleActive(p: Promotion) {
    setBusyId(p.id);
    try {
      await updatePromotion.mutateAsync({ id: p.id, data: { isActive: !p.isActive } });
      showToast(p.isActive ? `"${p.name}" pausada` : `"${p.name}" activada`);
    } catch {
      showToast('No se pudo cambiar la promoción', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: Promotion) {
    const message = p.usesCount > 0
      ? `¿Eliminar "${p.name}"? Los ${p.usesCount} pedidos que la usaron conservan el descuento. Si solo quieres detenerla, mejor páusala.`
      : `¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`;
    if (!await showConfirm({ message })) return;
    setBusyId(p.id);
    try {
      await deletePromotion.mutateAsync(p.id);
      showToast(`"${p.name}" eliminada`);
    } catch {
      showToast('No se pudo eliminar la promoción', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!restaurantId) {
    return <p style={{ fontFamily: sg, fontSize: 14, color: '#ef4444' }}>Tu cuenta no tiene un restaurante asignado.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: sg }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>Promociones</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)', maxWidth: 560 }}>
            Mueve los días flojos, sube el ticket promedio o trae clientes nuevos. Los precios los valida el sistema al recibir cada pedido.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setWizard({ mode: 'create' })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, border: 'none', background: ORANGE, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            + Nueva promoción
          </button>
        )}
      </div>

      {!advancedEnabled && (
        <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px', lineHeight: 1.5 }}>
          Tu plan incluye <strong>precio tachado, descuento al total y domicilio gratis</strong>. Combos, 2x1, regalos, cupones,
          promociones de primer pedido y el programa de fidelidad están en el plan con promociones avanzadas.
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const count = f.statuses.length ? withStatus.filter((x) => f.statuses.includes(x.status)).length : withStatus.length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${active ? ORANGE : 'var(--t-border)'}`, background: active ? `${ORANGE}14` : 'var(--t-surface)', color: active ? ORANGE : 'var(--t-text-2)', fontFamily: sg, fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer' }}
            >
              {f.label} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', border: `4px solid ${ORANGE}`, borderTopColor: 'transparent', display: 'block', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#b91c1c' }}>
          Error al cargar las promociones.
        </div>
      ) : visible.length === 0 ? (
        <div style={{ border: '2px dashed var(--t-border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center', background: 'var(--t-surface-2)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏷️</div>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)', margin: '0 0 6px' }}>
            {promotions.length === 0 ? 'Todavía no tienes promociones' : 'No hay promociones en este filtro'}
          </p>
          {promotions.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>
              Empieza con algo simple: un precio tachado en tu producto estrella o domicilio gratis desde un monto.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(({ promotion: p, status }) => (
            <article
              key={p.id}
              style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--t-surface)', border: '1px solid var(--t-border-2)', borderRadius: 16, padding: '14px 16px', flexWrap: 'wrap' }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: 'hidden', background: `${ORANGE}14`, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 14, color: ORANGE }}>
                {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : promotionBadge(p)}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--t-text-1)' }}>{p.name}</span>
                  <span style={{ padding: '3px 9px', borderRadius: 999, fontFamily: sm, fontSize: 10, fontWeight: 700, background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].color }}>
                    {PROMOTION_STATUS_LABEL[status]}
                  </span>
                  {p.couponCode && <span style={{ padding: '3px 9px', borderRadius: 999, fontFamily: sm, fontSize: 10, fontWeight: 700, background: '#f3e8ff', color: '#7e22ce' }}>CUPÓN {p.couponCode}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t-text-4)', marginTop: 2 }}>{PROMOTION_TYPE_LABEL[p.type]}</div>
                <div style={{ fontSize: 13, color: 'var(--t-text-2)', marginTop: 4, lineHeight: 1.45 }}>{describePromotion(p, names)}</div>
                <div style={{ fontSize: 12, color: 'var(--t-text-3)', marginTop: 4 }}>
                  {p.usesCount} {p.usesCount === 1 ? 'uso' : 'usos'}{p.maxUses ? ` de ${p.maxUses}` : ''}
                  {!p.showInMenu && !p.couponCode && ' · No se muestra en el banner'}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <IconButton title={p.isActive ? 'Pausar' : 'Activar'} disabled={busyId === p.id} onClick={() => toggleActive(p)}>
                    {p.isActive ? <Pause size={15} /> : <Play size={15} />}
                  </IconButton>
                  <IconButton title="Duplicar" onClick={() => setWizard({ mode: 'create', initial: duplicatePromotionForm(p) })}>
                    <Copy size={15} />
                  </IconButton>
                  <IconButton title="Editar" onClick={() => setWizard({ mode: 'edit', promotion: p })}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton title="Eliminar" disabled={busyId === p.id} onClick={() => remove(p)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Fidelidad */}
      {advancedEnabled && (
        <LoyaltySettings restaurantId={restaurantId} loyalty={restaurant?.loyalty} canManage={canManage} />
      )}

      {wizard && (
        <PromotionWizard
          key={wizard.mode === 'edit' ? wizard.promotion.id : 'new'}
          initial={wizard.mode === 'edit' ? promotionToForm(wizard.promotion) : wizard.initial}
          editingId={wizard.mode === 'edit' ? wizard.promotion.id : undefined}
          products={products}
          categories={categories}
          otherPromotions={promotions}
          advancedEnabled={advancedEnabled}
          saving={createPromotion.isPending || updatePromotion.isPending}
          onCancel={() => setWizard(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}
