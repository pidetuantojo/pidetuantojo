'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ROUTES } from '@/constants/routes';

/** Mapa de ruta → guía relevante. El orden importa: más específico primero. */
const CONTEXT_GUIDES: Array<{ path: string; section: string; guide: string; title: string }> = [
  // Configuración (impresoras antes que configuracion)
  { path: '/dashboard/configuracion/impresoras', section: 'configuracion', guide: 'impresoras', title: 'Configurar impresoras' },
  { path: '/dashboard/configuracion', section: 'configuracion', guide: 'datos-del-restaurante', title: 'Datos del restaurante' },
  // Pedidos
  { path: '/dashboard/pedidos', section: 'pedidos', guide: 'gestionar-un-pedido', title: 'Gestionar un pedido' },
  { path: '/dashboard/estados', section: 'pedidos', guide: 'gestionar-un-pedido', title: 'Gestionar un pedido' },
  // Menú
  { path: '/dashboard/productos', section: 'menu', guide: 'agregar-productos', title: 'Agregar productos' },
  { path: '/dashboard/categorias', section: 'menu', guide: 'agregar-categorias', title: 'Agregar categorías' },
  { path: '/dashboard/adicionales', section: 'menu', guide: 'agregar-productos', title: 'Agregar productos' },
  // Finanzas
  { path: '/dashboard/contabilidad', section: 'cobros', guide: 'contabilidad', title: 'Ver la contabilidad' },
  { path: '/dashboard/pagos', section: 'cobros', guide: 'metodos-de-pago', title: 'Métodos de pago' },
  // Domicilios (domiciliarios antes que la raíz)
  { path: '/dashboard/domicilios/domiciliarios', section: 'domicilios', guide: 'domiciliarios', title: 'Domiciliarios' },
  { path: '/dashboard/domicilios', section: 'domicilios', guide: 'zonas-y-tarifas', title: 'Zonas y tarifas' },
  // Equipo / WhatsApp
  { path: '/dashboard/equipo', section: 'configuracion', guide: 'equipo-y-permisos', title: 'Equipo y permisos' },
  { path: '/dashboard/whatsapp', section: 'configuracion', guide: 'whatsapp', title: 'Conectar WhatsApp' },
  { path: '/dashboard/notificaciones', section: 'configuracion', guide: 'whatsapp', title: 'Conectar WhatsApp' },
];

function matches(path: string, pathname: string) {
  return pathname === path || pathname.startsWith(path + '/');
}

export function ContextualHelpButton() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  // Resetear el tooltip al navegar (onMouseLeave no dispara si el click redirige)
  useEffect(() => { setHovered(false); }, [pathname]);

  // No mostrar dentro de la sección de ayuda
  if (pathname.startsWith('/dashboard/ayuda')) return null;

  const entry = CONTEXT_GUIDES.find(({ path }) => matches(path, pathname));
  if (!entry) return null;

  const href = ROUTES.dashboard.ayudaGuia(entry.section, entry.guide);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 90 }}>
      {/* Tooltip card */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 12px)',
            right: 0,
            background: 'var(--t-surface)',
            border: '1px solid var(--t-border)',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 6px 24px rgba(0,0,0,.16)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'var(--font-sans, sans-serif)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--t-text-3)',
              marginBottom: 3,
            }}
          >
            Guía de esta pantalla
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-1)' }}>
            {entry.title}
          </div>
          {/* Flecha */}
          <div
            style={{
              position: 'absolute',
              bottom: -5,
              right: 18,
              width: 9,
              height: 9,
              background: 'var(--t-surface)',
              borderRight: '1px solid var(--t-border)',
              borderBottom: '1px solid var(--t-border)',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      )}

      {/* Botón circular */}
      <Link
        href={href}
        aria-label={`Ver guía: ${entry.title}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 44,
          height: 44,
          borderRadius: '50%',
          textDecoration: 'none',
          background: hovered ? '#FF6A1A' : 'var(--t-surface)',
          border: `1.5px solid ${hovered ? '#FF6A1A' : 'var(--t-border)'}`,
          color: hovered ? '#fff' : '#FF6A1A',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'var(--font-sans, sans-serif)',
          boxShadow: hovered
            ? '0 4px 16px rgba(255,106,26,.4)'
            : '0 2px 12px rgba(0,0,0,.12)',
          transition: 'background .15s, color .15s, box-shadow .15s, border-color .15s',
          lineHeight: 1,
        }}
      >
        ?
      </Link>
    </div>
  );
}
