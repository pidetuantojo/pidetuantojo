'use client';

import { useState } from 'react';

import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { useUpdateRestaurant } from '@/features/restaurants/hooks/useRestaurantMutations';
import type { PaymentMethodConfig, PaymentMethodType } from '@/types';

import {
  IN_PERSON_TYPES,
  PAYMENT_METHOD_DEFINITIONS,
  TRANSFER_TYPES,
} from '../../constants/payment-methods.constants';
import {
  createPaymentMethodId,
  getConfiguredPaymentMethods,
  getPaymentLabel,
  normalizeAccount,
  validatePaymentAccount,
} from '../../helpers/payment-methods.helpers';
import { PaymentMethodIcon } from '../PaymentMethodIcon';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: 'none',
        background: checked ? '#FF6A1A' : 'var(--t-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', flexShrink: 0,
        transition: 'background .2s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        transition: 'left .2s',
      }} />
    </button>
  );
}

function MethodBadge({ type, active }: { type: PaymentMethodType; active: boolean }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: active ? '#FFF3EA' : 'var(--t-surface-2)',
      color: active ? '#FF6A1A' : 'var(--t-text-3)',
      display: 'grid', placeItems: 'center', transition: 'background .2s, color .2s',
    }}>
      <PaymentMethodIcon type={type} size={20} />
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--t-surface)',
  border: '1.5px solid var(--t-border-2)',
  borderRadius: 18,
  overflow: 'hidden',
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
  color: 'var(--t-text-3)', textTransform: 'uppercase',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

interface AccountForm {
  editingId?: string;
  type: PaymentMethodType;
  account: string;
  bankName: string;
}

export function PaymentMethodsManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';

  const { data: restaurant, isLoading } = useRestaurant(restaurantId || undefined);
  const updateRestaurant = useUpdateRestaurant();

  const [form, setForm] = useState<AccountForm | null>(null);
  const [formError, setFormError] = useState('');

  if (!restaurantId) return null;
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', border: '4px solid #FF6A1A', borderTopColor: 'transparent', display: 'block', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  const methods = getConfiguredPaymentMethods(restaurant?.paymentMethods);
  const transferAccounts = methods.filter((m) => PAYMENT_METHOD_DEFINITIONS[m.type].isTransfer);
  const activeCount = methods.filter((m) => m.isActive).length;
  const isSaving = updateRestaurant.isPending;

  async function save(next: PaymentMethodConfig[]) {
    await updateRestaurant.mutateAsync({ id: restaurantId, data: { paymentMethods: next } });
  }

  function isLastActive(method: PaymentMethodConfig | undefined) {
    return !!method?.isActive && activeCount === 1;
  }

  async function toggleInPerson(type: PaymentMethodType, value: boolean) {
    const existing = methods.find((m) => m.type === type);
    if (!value && isLastActive(existing)) return;
    const next = existing
      ? methods.map((m) => (m.id === existing.id ? { ...m, isActive: value } : m))
      : [...methods, { id: type, type, isActive: value }];
    await save(next);
  }

  async function toggleAccount(method: PaymentMethodConfig, value: boolean) {
    if (!value && isLastActive(method)) return;
    await save(methods.map((m) => (m.id === method.id ? { ...m, isActive: value } : m)));
  }

  async function deleteAccount(method: PaymentMethodConfig) {
    if (isLastActive(method)) return;
    const label = `${getPaymentLabel(method)} ${method.account ?? ''}`.trim();
    if (!confirm(`¿Eliminar la cuenta "${label}"?`)) return;
    await save(methods.filter((m) => m.id !== method.id));
  }

  function openForm(method?: PaymentMethodConfig) {
    setForm(
      method
        ? { editingId: method.id, type: method.type, account: method.account ?? '', bankName: method.bankName ?? '' }
        : { type: 'nequi', account: '', bankName: '' }
    );
    setFormError('');
  }

  function closeForm() {
    setForm(null);
    setFormError('');
  }

  async function handleSaveAccount() {
    if (!form) return;
    const error = validatePaymentAccount(form.type, form.account, form.bankName);
    if (error) { setFormError(error); return; }

    const account = normalizeAccount(form.type, form.account);
    const bankName = form.type === 'otro_banco' ? form.bankName.trim() : undefined;
    const duplicated = methods.some(
      (m) => m.id !== form.editingId &&
        m.type === form.type &&
        (m.account ?? '') === account &&
        (m.bankName ?? '').toLowerCase() === (bankName ?? '').toLowerCase()
    );
    if (duplicated) {
      setFormError(account ? 'Esa cuenta ya está agregada' : 'Ya agregaste este método sin número de cuenta');
      return;
    }

    // Sin `undefined` en los campos: Firestore los rechaza dentro de arrays
    const data: PaymentMethodConfig = {
      id: form.editingId ?? createPaymentMethodId(),
      type: form.type,
      isActive: true,
      ...(account ? { account } : {}),
      ...(bankName ? { bankName } : {}),
    };
    const next = form.editingId
      ? methods.map((m) => (m.id === form.editingId ? { ...data, isActive: m.isActive } : m))
      : [...methods, data];
    await save(next);
    closeForm();
  }

  const formDef = form ? PAYMENT_METHOD_DEFINITIONS[form.type] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: sg }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
          Métodos de pago
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)' }}>
          Elige cómo te pueden pagar tus clientes. Lo que actives acá es lo que verán al confirmar su pedido. Al menos uno debe quedar activo.
        </p>
      </div>

      {/* Pago presencial */}
      <div style={{ ...cardStyle, opacity: isSaving ? 0.7 : 1 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--t-border-2)' }}>
          <span style={sectionLabelStyle}>Pago al recibir o en el local</span>
        </div>
        {IN_PERSON_TYPES.map((type) => {
          const method = methods.find((m) => m.type === type);
          const active = method?.isActive ?? false;
          const lastActive = isLastActive(method);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--t-border-2)' }}>
              <MethodBadge type={type} active={active} />
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)' }}>
                {PAYMENT_METHOD_DEFINITIONS[type].label}
              </div>
              {lastActive && (
                <span style={{ fontFamily: sm, fontSize: 10, color: '#FF6A1A', background: '#FFF3EA', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                  mín. 1
                </span>
              )}
              <Toggle checked={active} onChange={(v) => toggleInPerson(type, v)} disabled={isSaving || lastActive} />
            </div>
          );
        })}
      </div>

      {/* Transferencias */}
      <div style={{ ...cardStyle, opacity: isSaving ? 0.7 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 20px', borderBottom: '1px solid var(--t-border-2)' }}>
          <div>
            <span style={sectionLabelStyle}>Cuentas para transferencias ({transferAccounts.length})</span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--t-text-3)' }}>
              Nequi, Daviplata, BreB, Bancolombia u otros bancos. Puedes agregar todas las cuentas que quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openForm()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Agregar cuenta
          </button>
        </div>

        {transferAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--t-text-3)', fontSize: 13 }}>
            Todavía no has agregado cuentas. Agrega una para que tus clientes puedan pagarte por transferencia.
          </div>
        ) : (
          transferAccounts.map((method) => {
            const lastActive = isLastActive(method);
            return (
              <div key={method.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--t-border-2)' }}>
                <MethodBadge type={method.type} active={method.isActive} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)' }}>{getPaymentLabel(method)}</div>
                  <div style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {method.account ?? 'Sin número visible para el cliente'}
                  </div>
                </div>
                <button type="button" aria-label="Editar cuenta" onClick={() => openForm(method)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button type="button" aria-label="Eliminar cuenta" onClick={() => deleteAccount(method)} disabled={isSaving || lastActive} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', cursor: lastActive ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', flexShrink: 0, opacity: lastActive ? 0.4 : 1 }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                </button>
                <Toggle checked={method.isActive} onChange={(v) => toggleAccount(method, v)} disabled={isSaving || lastActive} />
              </div>
            );
          })
        )}
      </div>

      {/* Modal cuenta */}
      {form && formDef && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div style={{ background: 'var(--t-surface)', borderRadius: 20, padding: '24px 24px', width: 440, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t-text-1)' }}>
                {form.editingId ? 'Editar cuenta' : 'Nueva cuenta'}
              </h3>
              <button type="button" onClick={closeForm} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--t-surface-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t-text-3)', fontSize: 16 }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', ...sectionLabelStyle, marginBottom: 8 }}>Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {TRANSFER_TYPES.map((type) => {
                  const sel = form.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => { setForm({ ...form, type }); setFormError(''); }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${sel ? '#FF6A1A' : 'var(--t-border-2)'}`,
                        background: sel ? '#FFF3EA' : 'var(--t-surface)',
                        color: sel ? '#FF6A1A' : 'var(--t-text-2)',
                        fontFamily: sg, fontWeight: 700, fontSize: 12,
                      }}
                    >
                      <PaymentMethodIcon type={type} size={18} />
                      {PAYMENT_METHOD_DEFINITIONS[type].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.type === 'otro_banco' && (
              <div>
                <label style={{ display: 'block', ...sectionLabelStyle, marginBottom: 6 }}>Nombre del banco</label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Ej: Davivienda, BBVA, Banco de Bogotá..."
                  style={{ width: '100%', border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: sg, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', ...sectionLabelStyle, marginBottom: 6 }}>
                {formDef.accountLabel} <span style={{ textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
              </label>
              <input
                type="text"
                inputMode={form.type === 'breb' ? 'text' : 'numeric'}
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder={formDef.accountPlaceholder}
                style={{ width: '100%', border: `1.5px solid ${formError ? '#fca5a5' : 'var(--t-input-border)'}`, background: 'var(--t-input-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: sm, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }}
              />
              {formError ? (
                <p style={{ fontSize: 12, color: '#ef4444', margin: '6px 0 0' }}>{formError}</p>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--t-text-3)', margin: '6px 0 0' }}>
                  Si lo dejas vacío, tus clientes verán solo el nombre del método y le pasas los datos por WhatsApp.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={closeForm} style={{ flex: 1, padding: '10px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', fontFamily: sg, fontWeight: 600, fontSize: 14, color: 'var(--t-text-3)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                disabled={isSaving}
                style={{ flex: 2, padding: '10px', borderRadius: 999, border: 'none', background: '#FF6A1A', color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? 'Guardando...' : form.editingId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
