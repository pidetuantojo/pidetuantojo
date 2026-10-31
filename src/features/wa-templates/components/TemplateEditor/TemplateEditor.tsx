'use client';

import { useRef, useState } from 'react';

import { applyTemplate, TEMPLATE_VARS } from '@/lib/whatsapp/templates.core';

export const EXAMPLE_DATA = {
  customerName: 'Juan García',
  orderNumber: '1042',
  // Ejemplo a domicilio con descuento, para ver todas las líneas del resumen
  subtotal: 46000,
  discount: 6000,
  deliveryType: 'domicilio' as const,
  deliveryFee: 5000,
  total: 45000,
  paymentMethod: 'Efectivo',
  statusName: 'En camino',
  items: [
    { productName: 'Hamburguesa clásica', quantity: 2 },
    { productName: 'Papas medianas', quantity: 1 },
  ],
};

const EMOJIS = [
  '👋', '😊', '😋', '🙌', '🎉', '🙏', '❤️', '🔥', '⭐', '👍',
  '✅', '✔️', '⏰', '⏳', '📍', '🏠', '📞', '💬', '📲', '🧾',
  '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥗', '🍗', '🍖', '🥩',
  '🍝', '🍜', '🍣', '🥟', '🍰', '🧁', '🍩', '🍦', '☕', '🥤',
  '🛵', '🚀', '🏍️', '📦', '🛍️', '🍽️', '💳', '💵', '💰', '🛒',
];

const chip: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
  border: '1px solid rgba(255,106,26,.35)', background: 'rgba(255,106,26,.08)', color: '#FF6A1A',
};

/** Editor de plantilla: campos y emojis que se insertan donde está el cursor, con vista previa en vivo. */
export function TemplateEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showEmojis, setShowEmojis] = useState(false);

  function insert(text: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    // Deja el cursor justo después de lo insertado
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-3)', margin: '0 0 6px' }}>
          Toca un campo para agregarlo al mensaje
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TEMPLATE_VARS.map((v) => (
            <button key={v.key} type="button" onClick={() => insert(v.key)} title={`Agrega ${v.key}`} style={chip}>
              + {v.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEmojis((s) => !s)}
            aria-expanded={showEmojis}
            style={{ ...chip, border: '1px solid var(--t-border)', background: showEmojis ? 'var(--t-surface-2)' : 'transparent', color: 'var(--t-text-2)' }}
          >
            😊 Emojis
          </button>
        </div>
      </div>

      {showEmojis && (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 2, padding: 8, borderRadius: 10, border: '1px solid var(--t-border)', background: 'var(--t-surface-2)' }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e} type="button" onClick={() => insert(e)} aria-label={`Agregar ${e}`}
              style={{ fontSize: 20, lineHeight: 1, padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--t-surface)'; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        placeholder="Escribe el mensaje. Ej: Hola {{nombreCliente}}, tu pedido está listo 🎉"
        style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, color: 'var(--t-text-1)', background: 'var(--t-surface-2)', border: '1.5px solid var(--t-border)', borderRadius: 10, padding: '12px 14px', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
        onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--t-border)'; }}
      />
      <p style={{ fontSize: 12, color: 'var(--t-text-4)', margin: '-6px 0 0' }}>
        Tip: escribe *texto* para ponerlo en negrita en WhatsApp.
      </p>

      <TemplatePreview body={value} />
    </div>
  );
}

/** Así le llega el mensaje al cliente, con datos de ejemplo. */
export function TemplatePreview({ body, statusName }: { body: string; statusName?: string }) {
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', margin: '0 0 8px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
        Así lo recibe el cliente (ejemplo)
      </p>
      <pre style={{ margin: 0, fontSize: 13, color: '#166534', fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {body.trim() ? applyTemplate(body, { ...EXAMPLE_DATA, statusName: statusName || EXAMPLE_DATA.statusName }) : 'El mensaje está vacío.'}
      </pre>
    </div>
  );
}
