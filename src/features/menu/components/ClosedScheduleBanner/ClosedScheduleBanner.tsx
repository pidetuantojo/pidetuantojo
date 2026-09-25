import { Clock } from 'lucide-react';

const sg = "var(--font-sans, sans-serif)";

/** Aviso para cuando el local está cerrado pero acepta pedidos programados. */
export function ClosedScheduleBanner() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        color: '#065f46',
        fontFamily: sg,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <Clock size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <p style={{ margin: 0, minWidth: 0 }}>
        Estamos cerrados en este momento. Puedes <strong>programar tu pedido</strong> para cuando abramos: agrega
        productos al carrito y, en el pago, selecciona <strong>“Programar para más tarde”</strong>.
      </p>
    </div>
  );
}
