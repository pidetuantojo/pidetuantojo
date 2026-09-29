'use client';

import { useAuth } from '@/features/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { AppLoader } from '@/components/ui/AppLoader';
import { ROUTES } from '@/constants/routes';
import { canAccessPath, firstAllowedRoute } from '@/lib/permissions/permissions';

/**
 * Destino al que hay que mandar al usuario si no puede estar en `pathname` (null = puede quedarse).
 * - super_admin: solo /admin/* (no tiene restaurante).
 * - usuarios de restaurante: nunca /admin/*; en /dashboard/* necesitan el permiso de la ruta.
 */
function redirectTarget(role: string, permissions: readonly string[], pathname: string): string | null {
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (role === 'super_admin') return inAdmin ? null : ROUTES.admin.restaurants;
  if (!inAdmin && canAccessPath(permissions, pathname)) return null;
  return firstAllowedRoute(permissions) ?? 'none';
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, permissions, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const target = user ? redirectTarget(user.role, permissions, pathname) : null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(ROUTES.login);
      return;
    }
    if (target && target !== 'none' && target !== pathname) router.replace(target);
  }, [user, loading, target, pathname, router]);

  // Cerrar sidebar al navegar en mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) return <AppLoader theme="dark" message="Cargando" />;
  if (!user) return null;

  // Sin ningún permiso: mensaje en vez de un bucle de redirecciones
  if (target === 'none') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--t-bg)', fontFamily: 'var(--font-sans, sans-serif)', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, color: 'var(--t-text-1)' }}>Tu usuario no tiene permisos asignados</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-3)' }}>Pídele al administrador del restaurante que te asigne permisos en Equipo.</p>
          <button type="button" onClick={() => void signOut()} style={{ alignSelf: 'center', padding: '10px 20px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }
  // Mientras redirige, no mostrar una pantalla sin permiso
  if (target) return <AppLoader theme="dark" message="Cargando" />;

  return (
    <div className="flex h-screen" style={{ background: 'var(--t-bg)', fontFamily: "var(--font-sans, sans-serif)" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar — solo visible en mobile */}
        <header
          className="flex md:hidden items-center gap-3 px-4 sticky top-0 z-30"
          style={{ height: 56, background: 'var(--t-sb-to)', borderBottom: '1px solid rgba(255,255,255,.08)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#FBF6F1', letterSpacing: '-.01em' }}>
            Antojo<span style={{ color: '#FF6A1A' }}>.</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
