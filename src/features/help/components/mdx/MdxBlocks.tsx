// Bloques disponibles dentro de las guías .mdx (registrados en src/mdx-components.tsx)
import Link from 'next/link';

const sg = "var(--font-sans, sans-serif)";

const CALLOUT_TONES = {
  tip: { label: 'Tip', bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46' },
  warning: { label: 'Ojo', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
  info: { label: 'Nota', bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
} as const;

export function Callout({ type = 'info', title, children }: { type?: keyof typeof CALLOUT_TONES; title?: string; children: React.ReactNode }) {
  const tone = CALLOUT_TONES[type];
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, borderRadius: 14, padding: '12px 16px', margin: '16px 0', fontSize: 14, lineHeight: 1.6 }}>
      <strong style={{ display: 'block', marginBottom: 2 }}>{title ?? tone.label}</strong>
      {children}
    </div>
  );
}

/** Lista numerada de pasos. Cada hijo debe ser un <Step>. */
export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 4, counterReset: 'help-step' }}>
      <style>{'.help-step{counter-increment:help-step}.help-step-num::before{content:counter(help-step)}'}</style>
      {children}
    </ol>
  );
}

export function Step({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <li className="help-step" style={{ display: 'flex', gap: 14, padding: '10px 0' }}>
      <span
        aria-hidden
        className="help-step-num"
        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: '#FF6A1A', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, fontFamily: sg }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '4px 0 2px', fontWeight: 800, fontSize: 15, color: 'var(--t-text-1)' }}>{title}</p>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--t-text-2)' }}>{children}</div>
      </div>
    </li>
  );
}

/** Nombre de un botón o elemento de la pantalla, para que se reconozca al leer. */
export function Ui({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', padding: '0 7px', borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-surface-2)', color: 'var(--t-text-1)', fontWeight: 700, fontSize: '0.92em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} style={{ color: '#FF6A1A', fontWeight: 700 }}>{children}</Link>;
}
