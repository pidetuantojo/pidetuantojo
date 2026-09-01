'use client';

import { useAuth } from '@/features/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { AppLoader } from '@/components/ui/AppLoader';
import { ROUTES } from '@/constants/routes';

const VIEW_ALLOWED_ROUTES: string[] = [ROUTES.dashboard.pedidos, ROUTES.dashboard.contabilidad];
// Contabilidad: /dashboard/contabilidad

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(ROUTES.login);
      return;
    }
    if (user.role === 'restaurant_view' && !VIEW_ALLOWED_ROUTES.includes(pathname)) {
      router.replace(ROUTES.dashboard.pedidos);
    }
  }, [user, loading, pathname, router]);

  // Cerrar sidebar al navegar en mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) return <AppLoader theme="dark" message="Cargando" />;
  if (!user) return null;

  return (
    <div className="flex h-screen" style={{ background: '#FBF8F5', fontFamily: "var(--font-space-grotesk, 'Inter', sans-serif)" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar — solo visible en mobile */}
        <header
          className="flex md:hidden items-center gap-3 px-4 sticky top-0 z-30"
          style={{ height: 56, background: '#1B1512', borderBottom: '1px solid rgba(255,255,255,.08)' }}
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
