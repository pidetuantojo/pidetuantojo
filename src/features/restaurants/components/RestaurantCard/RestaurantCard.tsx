'use client';

import Image from 'next/image';

import type { RestaurantCardProps } from './RestaurantCard.types';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

export function RestaurantCard({
  restaurant,
  onEdit,
  onToggleActive,
  onDelete,
  isToggling,
  isDeleting,
}: RestaurantCardProps) {
  const { id, name, slug, description, phone, logo, isActive, theme } = restaurant;
  const primaryColor = theme.primaryColor;

  const headerBg = logo
    ? 'var(--t-surface-2)'
    : isActive
      ? `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}44)`
      : 'var(--t-surface-2)';

  const nameColor = logo ? 'var(--t-text-1)' : isActive ? primaryColor : 'var(--t-text-3)';

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: sg, fontWeight: 500, fontSize: 13, borderRadius: 999,
    padding: '10px 14px', cursor: 'pointer', border: '1.5px solid var(--t-border)',
    background: 'var(--t-surface)', color: 'var(--t-text-2)', transition: 'background .15s',
  };

  return (
    <article
      className="rcard"
      style={{
        background: 'var(--t-surface)', border: '1px solid var(--t-border-2)', borderRadius: 16,
        overflow: 'hidden', fontFamily: sg,
        transition: 'transform .18s, box-shadow .18s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px -22px rgba(27,21,18,.4)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'relative', height: 130,
          background: headerBg,
          display: 'grid', placeItems: 'center',
        }}
      >
        {logo ? (
          <Image src={logo} alt={name} fill className="object-contain p-4" />
        ) : (
          <div style={{ fontWeight: 700, fontSize: 30, color: nameColor, letterSpacing: '-.02em' }}>
            {name}
          </div>
        )}
        <span
          style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: sm, fontSize: 10, fontWeight: 700,
            color: isActive ? '#2C7A52' : 'var(--t-text-3)',
            background: isActive ? '#DFF3E7' : 'var(--t-surface-2)',
            borderRadius: 999, padding: '5px 10px',
          }}
        >
          ● {isActive ? 'ACTIVO' : 'INACTIVO'}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '18px 18px 8px' }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--t-text-1)', marginBottom: 4 }}>{name}</div>

        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: sm, fontSize: 12, color: '#FF6A1A', textDecoration: 'none', marginBottom: 12,
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
          /{slug}
        </a>

        {description && (
          <p style={{ fontSize: 13, color: 'var(--t-text-2)', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {description}
          </p>
        )}

        {phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)', marginBottom: 14 }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
            </svg>
            {phone}
          </div>
        )}

        {/* Theme colors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 2 }}>
          <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-3)' }}>Tema</span>
          {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map((color, i) => (
            <span
              key={i}
              title={color}
              style={{
                width: 18, height: 18, borderRadius: '50%', backgroundColor: color,
                border: '2px solid var(--t-surface)', boxShadow: '0 0 0 1px var(--t-border)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--t-border)' }}>
        <button
          style={{ ...btnBase, flex: 1, opacity: isToggling ? 0.6 : 1 }}
          onClick={() => onToggleActive(id, !isActive)}
          disabled={isToggling}
        >
          {isActive ? (
            <>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
              </svg>
              Desactivar
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              Activar
            </>
          )}
        </button>

        <button style={{ ...btnBase, flex: 1 }} onClick={() => onEdit(restaurant)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
          </svg>
          Editar
        </button>

        <button
          style={{ ...btnBase, borderColor: '#F6D3CE', color: '#D8412F', background: '#FDF1EF', flexShrink: 0, padding: '10px 12px', opacity: isDeleting ? 0.6 : 1 }}
          onClick={() => onDelete(id, name)}
          disabled={isDeleting}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </article>
  );
}
