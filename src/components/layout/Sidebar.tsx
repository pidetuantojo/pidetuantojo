'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { ROUTES } from '@/constants/routes';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

function BiteLogo() {
  return (
    <svg viewBox="0 0 1024 1024" width="30" height="30">
      <defs>
        <linearGradient id="sb-g" x1="102" y1="102" x2="922" y2="922" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFB02E" />
          <stop offset="0.55" stopColor="#FF6A1A" />
          <stop offset="1" stopColor="#EA3B2E" />
        </linearGradient>
        <mask id="sb-m">
          <rect width="1024" height="1024" fill="#fff" />
          <circle cx="819.2" cy="215" r="307.2" fill="#000" />
        </mask>
      </defs>
      <circle cx="512" cy="512" r="512" fill="url(#sb-g)" mask="url(#sb-m)" />
    </svg>
  );
}

const SUPER_ADMIN_LINKS = [
  {
    href: ROUTES.admin.restaurants,
    label: 'Restaurantes',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
      </svg>
    ),
  },
];

const RESTAURANT_VIEW_LINKS = [
  {
    href: ROUTES.dashboard.pedidos,
    label: 'Pedidos',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.contabilidad,
    label: 'Contabilidad',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
      </svg>
    ),
  },
];

const RESTAURANT_LINKS = [
  {
    href: ROUTES.dashboard.root,
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.pedidos,
    label: 'Pedidos',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.menu,
    label: 'Menú',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.estados,
    label: 'Estados',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.contabilidad,
    label: 'Contabilidad',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.equipo,
    label: 'Equipo',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.domicilios,
    label: 'Domicilios',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
      </svg>
    ),
  },
  {
    href: ROUTES.dashboard.configuracion,
    label: 'Configuración menú',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const isSuperAdmin = user?.role === 'super_admin';
  const isViewOnly = user?.role === 'restaurant_view';
  const links = isSuperAdmin ? SUPER_ADMIN_LINKS : isViewOnly ? RESTAURANT_VIEW_LINKS : RESTAURANT_LINKS;

  const { data: restaurant } = useRestaurant(!isSuperAdmin ? user?.restaurantId : undefined);

  const initial = (user?.displayName ?? user?.email ?? '?')[0].toUpperCase();
  const restaurantInitial = (restaurant?.name ?? '?')[0].toUpperCase();

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,.55)' }}
          onClick={onClose}
        />
      )}

    <aside
      className={`flex flex-shrink-0 flex-col fixed inset-y-0 left-0 z-50 md:static md:z-auto transition-all duration-300 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      style={{
        width: collapsed ? 68 : 260,
        background: 'radial-gradient(120% 60% at 20% 0%, #3a2417, #1B1512 55%)',
        minHeight: '100vh',
        padding: collapsed ? '26px 10px' : '26px 18px',
        fontFamily: sg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 11, padding: '0 8px', marginBottom: 6 }}>
        <BiteLogo />
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-.02em', color: '#FBF6F1', lineHeight: 1 }}>
              Antojo<span style={{ color: '#FF6A1A' }}>.</span>
            </div>
            {isSuperAdmin && (
              <div style={{ fontFamily: sm, fontSize: 9, letterSpacing: '.12em', color: '#FF8A3D', marginTop: 3 }}>
                SUPER ADMIN
              </div>
            )}
            {isViewOnly && (
              <div style={{ fontFamily: sm, fontSize: 9, letterSpacing: '.12em', color: '#9a8f86', marginTop: 3 }}>
                SOLO LECTURA
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '22px 8px' }} />

      {/* Restaurant selector */}
      {!isSuperAdmin && restaurant && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: collapsed ? '11px 4px' : '11px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 13, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
              background: restaurant.logo ? '#fff' : 'linear-gradient(135deg, #FFB02E, #EA3B2E)',
              display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 16, color: '#fff', position: 'relative',
            }}
          >
            {restaurant.logo ? (
              <Image src={restaurant.logo} alt={restaurant.name} fill style={{ objectFit: 'contain', padding: 4 }} />
            ) : (
              restaurantInitial
            )}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#fbf6f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {restaurant.name}
              </div>
              <div style={{ fontFamily: sm, fontSize: 10, color: restaurant.isActive ? '#7BD88F' : '#b8aaa0' }}>
                {restaurant.isActive ? '● Abierto' : '● Cerrado'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 12,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '11px 0' : '11px 14px',
                borderRadius: 11, fontWeight: 500, fontSize: 14, textDecoration: 'none',
                transition: 'background .15s, color .15s',
                background: active ? 'linear-gradient(135deg, rgba(255,138,43,.22), rgba(234,59,46,.14))' : 'transparent',
                color: active ? '#fff' : '#b8aaa0',
              }}
            >
              {icon}
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ marginTop: 12, flexShrink: 0 }}>
        {/* Toggle collapse — solo desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex"
          style={{
            alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '9px 0', marginBottom: 8,
            borderRadius: 11, border: 'none', background: 'rgba(255,255,255,.06)',
            cursor: 'pointer', color: '#b8aaa0', transition: 'background .15s',
          }}
          title={collapsed ? 'Expandir' : 'Contraer'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .3s' }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && <span style={{ fontFamily: sg, fontSize: 12, marginLeft: 6 }}>Contraer</span>}
        </button>

        {!collapsed && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '12px 10px',
              borderRadius: 12, background: 'rgba(255,255,255,.05)',
            }}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #FFB02E, #EA3B2E)',
                display: 'grid', placeItems: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff',
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#fbf6f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName ?? 'Admin'}
              </div>
              <div style={{ fontFamily: sm, fontSize: 10, color: '#b8aaa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => signOut()}
          title={collapsed ? 'Cerrar sesión' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 12,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '11px 0' : '11px 14px',
            borderRadius: 11, fontWeight: 500, fontSize: 14, color: '#b8aaa0',
            background: 'none', border: 'none', cursor: 'pointer', width: '100%',
            marginTop: 6, fontFamily: sg, transition: 'color .15s',
          }}
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
    </>
  );
}
