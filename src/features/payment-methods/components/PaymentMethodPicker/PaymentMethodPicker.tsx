import type { PaymentMethodConfig } from '@/types';

import { getPaymentLabel } from '../../helpers/payment-methods.helpers';
import { PaymentMethodIcon } from '../PaymentMethodIcon';

const sg = "var(--font-sans, sans-serif)";

interface PaymentMethodPickerProps {
  methods: PaymentMethodConfig[];
  value: string;
  onChange: (id: string) => void;
}

/** Selector de método de pago para los modales del dashboard (pedido manual / editar pedido). */
export function PaymentMethodPicker({ methods, value, onChange }: PaymentMethodPickerProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
      {methods.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m.id)}
            style={{
              padding: '8px 10px', borderRadius: 14, minWidth: 0,
              border: `2px solid ${active ? '#FF6A1A' : 'var(--t-border-2)'}`,
              background: 'var(--t-surface)', color: active ? '#FF6A1A' : 'var(--t-text-2)',
              fontFamily: sg, cursor: 'pointer', transition: 'all .12s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
              <PaymentMethodIcon type={m.type} size={15} />
              {getPaymentLabel(m)}
            </span>
            {m.account && (
              <span style={{ fontSize: 11, color: 'var(--t-text-3)', maxWidth: '100%', overflowWrap: 'anywhere' }}>{m.account}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
