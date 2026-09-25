'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { ROUTES } from '@/constants/routes';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

const MODULES = [
  {
    href: ROUTES.dashboard.pedidos,
    label: 'Pedidos',
    desc: 'Gestioná órdenes en tiempo real',
    iconBg: 'linear-gradient(135deg, #FF8A2B, #EA3B2E)',
    iconShadow: 'rgba(234,59,46,.5)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.productos,
    label: 'Productos',
    desc: 'Productos, categorías y adicionales',
    iconBg: 'linear-gradient(135deg, #FBB03B, #F59211)',
    iconShadow: 'rgba(245,146,17,.5)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.contabilidad,
    label: 'Contabilidad',
    desc: 'Estadísticas y métricas del negocio',
    iconBg: 'linear-gradient(135deg, #3F9E6A, #2C7A52)',
    iconShadow: 'rgba(44,122,82,.5)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.estados,
    label: 'Estados de pedidos',
    desc: 'Configurá el flujo de tus pedidos',
    iconBg: 'linear-gradient(135deg, #8a7f76, #5a5048)',
    iconShadow: 'rgba(90,80,72,.5)',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
];

function getNow() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();
}

function getTime() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { data: restaurant } = useRestaurant(user?.restaurantId);

  const firstName = user?.displayName?.split(' ')[0] ?? 'Admin';
  const slug = restaurant?.slug ?? '';

  return (
    <div style={{ fontFamily: sg, maxWidth: 960, margin: '0 auto' }}>

      {/* Hero */}
      <div
        style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          background: 'linear-gradient(120deg, #FF8A2B, #FF6A1A 52%, #EA3B2E)',
          padding: '32px 36px', marginBottom: 24,
        }}
      >
        {/* Watermark bite logo */}
        <div style={{ position: 'absolute', right: -30, top: -30, lineHeight: 0, opacity: 0.13, pointerEvents: 'none' }}>
          <svg viewBox="0 0 1024 1024" width="230" height="230">
            <mask id="hero-m">
              <rect width="1024" height="1024" fill="#fff" />
              <circle cx="819.2" cy="215" r="307.2" fill="#000" />
            </mask>
            <circle cx="512" cy="512" r="512" fill="#fff" mask="url(#hero-m)" />
          </svg>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: sm, fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.85)', marginBottom: 6 }}>
            {getNow()} · {getTime()}
          </div>
          <h2 style={{ fontWeight: 700, fontSize: 34, letterSpacing: '-.02em', color: '#fff', margin: '0 0 6px' }}>
            ¡Hola, {firstName}! 👋
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.92)', margin: 0 }}>
            Este es el panel de gestión de <strong>{restaurant?.name ?? 'tu restaurante'}</strong>. Todo bajo control.
          </p>
        </div>
      </div>

      {/* Gestión */}
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--t-text-1)', marginBottom: 14 }}>Gestión</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {MODULES.map(({ href, label, desc, iconBg, iconShadow, icon }) => (
          <Link
            key={href}
            href={href}
            style={{
              background: 'var(--t-surface)', border: '1px solid var(--t-border-2)', borderRadius: 16,
              padding: 22, textDecoration: 'none', display: 'block',
              transition: 'transform .18s, box-shadow .18s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px -22px rgba(27,21,18,.28)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '';
            }}
          >
            <div
              style={{
                width: 46, height: 46, borderRadius: 13, background: iconBg,
                display: 'grid', placeItems: 'center', marginBottom: 16,
                boxShadow: `0 8px 18px -8px ${iconShadow}`,
              }}
            >
              {icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--t-text-1)', marginBottom: 4 }}>{label}</div>
            <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: 0 }}>{desc}</p>
          </Link>
        ))}

        {/* Ver carta pública */}
        {slug && (
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'linear-gradient(135deg, #1B1512, #3a2417)', border: '1px solid #2a1f17',
              borderRadius: 16, padding: 22, textDecoration: 'none',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              transition: 'transform .18s, box-shadow .18s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px -22px rgba(27,21,18,.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '';
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 6 }}>
              Ver mi carta pública →
            </div>
            <p style={{ fontFamily: sm, fontSize: 12, color: '#b8aaa0', margin: 0 }}>
              antojo.app/{slug}
            </p>
          </a>
        )}
      </div>
    </div>
  );
}
