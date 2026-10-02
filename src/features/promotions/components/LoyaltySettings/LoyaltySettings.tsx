'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';

import { useUpdateRestaurant } from '@/features/restaurants/hooks/useRestaurantMutations';
import { useToastStore } from '@/store/toast.store';
import type { LoyaltyConfig } from '@/types';

import { formatMoney } from '../../engine';
import { parseAmount } from '../../helpers/promotionForm';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

const DEFAULT_LOYALTY: LoyaltyConfig = { isActive: false, ordersRequired: 10, rewardKind: 'percent', rewardValue: 100, maxReward: 30000 };

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10,
  padding: '9px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box',
};

interface LoyaltySettingsProps {
  restaurantId: string;
  loyalty?: LoyaltyConfig;
  canManage: boolean;
}

/** "Cada N pedidos entregados o pagados, un premio" (sellos por celular). */
export function LoyaltySettings({ restaurantId, loyalty, canManage }: LoyaltySettingsProps) {
  const updateRestaurant = useUpdateRestaurant();
  const { showToast } = useToastStore();
  const [config, setConfig] = useState<LoyaltyConfig>(loyalty ?? DEFAULT_LOYALTY);
  const [form, setForm] = useState({ ordersRequired: '', minSubtotal: '', rewardValue: '', maxReward: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const c = loyalty ?? DEFAULT_LOYALTY;
    setConfig(c);
    setForm({
      ordersRequired: String(c.ordersRequired),
      minSubtotal: c.minSubtotal ? String(c.minSubtotal) : '',
      rewardValue: String(c.rewardValue),
      maxReward: c.maxReward ? String(c.maxReward) : '',
    });
  }, [loyalty]);

  async function save(next: Partial<LoyaltyConfig> = {}) {
    const ordersRequired = parseAmount(form.ordersRequired) ?? 0;
    const rewardValue = parseAmount(form.rewardValue) ?? 0;
    if (ordersRequired < 2 || ordersRequired > 50) { setError('Los pedidos para ganar deben estar entre 2 y 50'); return; }
    if (rewardValue <= 0) { setError('Escribe el valor del premio'); return; }
    if (config.rewardKind === 'percent' && rewardValue > 100) { setError('El porcentaje no puede ser mayor a 100'); return; }
    setError('');

    const loyaltyToSave: LoyaltyConfig = {
      isActive: config.isActive,
      ordersRequired,
      rewardKind: config.rewardKind,
      rewardValue,
      ...(parseAmount(form.minSubtotal) ? { minSubtotal: parseAmount(form.minSubtotal) } : {}),
      ...(config.rewardKind === 'percent' && parseAmount(form.maxReward) ? { maxReward: parseAmount(form.maxReward) } : {}),
      ...next,
    };
    try {
      await updateRestaurant.mutateAsync({ id: restaurantId, data: { loyalty: loyaltyToSave } });
      setConfig(loyaltyToSave);
      showToast(loyaltyToSave.isActive ? 'Programa de fidelidad guardado' : 'Programa de fidelidad apagado');
    } catch {
      showToast('No se pudo guardar el programa de fidelidad', 'error');
    }
  }

  const reward = config.rewardKind === 'amount'
    ? `${formatMoney(parseAmount(form.rewardValue) ?? 0)} de descuento`
    : `${parseAmount(form.rewardValue) ?? 0}% de descuento${parseAmount(form.maxReward) ? ` (hasta ${formatMoney(parseAmount(form.maxReward) ?? 0)})` : ''}`;

  return (
    <section style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border-2)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: sg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef3c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Gift size={20} color="#d97706" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--t-text-1)' }}>Programa de fidelidad</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>
              Cada {parseAmount(form.ordersRequired) || 'N'} pedidos el cliente gana {reward}. Se identifica por su celular.
            </p>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: config.isActive ? '#059669' : 'var(--t-text-3)', cursor: canManage ? 'pointer' : 'default' }}>
          <input
            type="checkbox"
            checked={config.isActive}
            disabled={!canManage || updateRestaurant.isPending}
            onChange={(e) => { setConfig((c) => ({ ...c, isActive: e.target.checked })); void save({ isActive: e.target.checked }); }}
            style={{ width: 16, height: 16, accentColor: ORANGE }}
          />
          {config.isActive ? 'Activo' : 'Apagado'}
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Field label="Pedidos para ganar">
          <input inputMode="numeric" disabled={!canManage} value={form.ordersRequired} onChange={(e) => setForm((f) => ({ ...f, ordersRequired: e.target.value.replace(/[^\d]/g, '') }))} style={inputStyle} />
        </Field>
        <Field label="Mínimo por pedido" hint="Para que cuente el sello">
          <input inputMode="numeric" disabled={!canManage} value={form.minSubtotal} placeholder="Sin mínimo" onChange={(e) => setForm((f) => ({ ...f, minSubtotal: e.target.value.replace(/[^\d]/g, '') }))} style={inputStyle} />
        </Field>
        <Field label="Premio">
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              disabled={!canManage}
              value={config.rewardKind}
              onChange={(e) => setConfig((c) => ({ ...c, rewardKind: e.target.value as LoyaltyConfig['rewardKind'] }))}
              style={{ ...inputStyle, width: 70, padding: '9px 6px' }}
              aria-label="Tipo de premio"
            >
              <option value="percent">%</option>
              <option value="amount">$</option>
            </select>
            <input inputMode="numeric" disabled={!canManage} value={form.rewardValue} onChange={(e) => setForm((f) => ({ ...f, rewardValue: e.target.value.replace(/[^\d]/g, '') }))} style={inputStyle} aria-label="Valor del premio" />
          </div>
        </Field>
        {config.rewardKind === 'percent' && (
          <Field label="Tope del premio" hint="100% + tope = pedido gratis hasta $X">
            <input inputMode="numeric" disabled={!canManage} value={form.maxReward} placeholder="Sin tope" onChange={(e) => setForm((f) => ({ ...f, maxReward: e.target.value.replace(/[^\d]/g, '') }))} style={inputStyle} />
          </Field>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--t-text-3)', lineHeight: 1.5 }}>
        Solo suman sellos los pedidos que marques como <strong>Entregado</strong> o <strong>Pagado</strong>, así un pedido falso no cuenta.
        Cuando alguien canjea, el pedido llega con la etiqueta 🎁 <strong>Canje de fidelidad</strong> para que lo confirmes.
      </p>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{error}</p>}
      {canManage && (
        <div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={updateRestaurant.isPending}
            style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: ORANGE, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: updateRestaurant.isPending ? 0.7 : 1 }}
          >
            {updateRestaurant.isPending ? 'Guardando...' : 'Guardar programa'}
          </button>
        </div>
      )}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={{ display: 'block', fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: 'var(--t-text-3)', textTransform: 'uppercase', marginBottom: 5 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--t-text-4)', marginTop: 3 }}>{hint}</span>}
    </div>
  );
}
