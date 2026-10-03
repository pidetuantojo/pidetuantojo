'use client';

import { useAuth } from '@/features/auth';
import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { usePlan } from '@/features/plans/hooks/usePlans';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { AppLoader } from '@/components/ui/AppLoader';
import { Toaster } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ROUTES } from '@/constants/routes';
import { canAccessPath, firstAllowedRoute } from '@/lib/permissions/permissions';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';
import { getMissingRestaurantFields } from '@/features/restaurants/helpers/getMissingRestaurantFields';

/**
 * Destino al que hay que mandar al usuario si no puede estar en `pathname` (null = puede quedarse).
 * - super_admin: solo /admin/* (no tiene restaurante).
 * - usuarios de restaurante: nunca /admin/*; en /dashboard/* necesitan el permiso de la ruta.
 */
function redirectTarget(
  role: string,
  permissions: readonly string[],
  pathname: string
): string | null {
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (role === 'super_admin') return inAdmin ? null : ROUTES.admin.restaurants;
  if (!inAdmin && canAccessPath(permissions, pathname)) return null;
  return firstAllowedRoute(permissions) ?? 'none';
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, permissions, signOut } = useAuth();
  const { data: restaurant } = useRestaurant(user?.restaurantId ?? undefined);
  const { data: restaurantPlan } = usePlan(restaurant?.planId);
  const subscriptionInfo = restaurant
    ? getSubscriptionInfo(restaurant, restaurantPlan?.billingPeriod)
    : null;
  const showGraceBanner =
    user?.role !== 'super_admin' && subscriptionInfo?.status === 'grace_period';
  const missingFields =
    restaurant && user?.role === 'restaurant_admin' ? getMissingRestaurantFields(restaurant) : [];
  const showSetupBanner = missingFields.length > 0;
  const isSuspended = user?.role !== 'super_admin' && subscriptionInfo?.status === 'suspended';
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
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--t-bg)',
          fontFamily: 'var(--font-sans, sans-serif)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, color: 'var(--t-text-1)' }}>
            Tu usuario no tiene permisos asignados
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-3)' }}>
            Pídele al administrador del restaurante que te asigne permisos en Equipo.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              alignSelf: 'center',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1.5px solid var(--t-border)',
              background: 'var(--t-surface)',
              color: 'var(--t-text-2)',
              cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }
  // Mientras redirige, no mostrar una pantalla sin permiso
  if (target) return <AppLoader theme="dark" message="Cargando" />;

  // Suscripción suspendida — bloquear todo el dashboard
  if (isSuspended) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--t-bg)',
          fontFamily: 'var(--font-sans, sans-serif)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
            }}
          >
            🔒
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--t-text-1)' }}>
            Suscripción vencida
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-3)', lineHeight: 1.6 }}>
            Tu plan venció el{' '}
            <strong>
              {subscriptionInfo?.endDate?.toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>{' '}
            y el período de gracia ya expiró. Contactá a soporte para reactivar tu cuenta.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              border: '1.5px solid var(--t-border)',
              background: 'var(--t-surface)',
              color: 'var(--t-text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans, sans-serif)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen"
      style={{ background: 'var(--t-bg)', fontFamily: 'var(--font-sans, sans-serif)' }}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — solo visible en mobile */}
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 md:hidden"
          style={{
            height: 56,
            background: 'var(--t-sb-to)',
            borderBottom: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,.08)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          {restaurant?.name ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 1.25,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#FBF6F1',
                  letterSpacing: '-.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {restaurant.name}
              </span>
              <span
                style={{ fontSize: 10, color: '#FF6A1A', letterSpacing: '.04em', fontWeight: 500 }}
              >
                Pide Tu Antojo
              </span>
            </div>
          ) : (
            <span
              style={{ fontWeight: 700, fontSize: 17, color: '#FBF6F1', letterSpacing: '-.01em' }}
            >
              Antojo<span style={{ color: '#FF6A1A' }}>.</span>
            </span>
          )}
        </header>

        {/* Setup incompleto — solo para restaurant_admin */}
        {showSetupBanner && (
          <div
            style={{
              background: '#fff7ed',
              borderBottom: '1px solid #fed7aa',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              flexWrap: 'wrap',
              fontFamily: 'var(--font-sans, sans-serif)',
              fontSize: 13,
              color: '#7c2d12',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🚧</span>
            <span style={{ flex: 1, lineHeight: 1.5 }}>
              <strong>Tu menú público muestra &ldquo;Próximamente&rdquo;</strong> porque falta configurar:{' '}
              {missingFields.map((f, i) => (
                <span key={f.key}>
                  {i > 0 && ', '}
                  <strong>{f.label}</strong>
                </span>
              ))}
              .{' '}
              <a
                href="/dashboard/configuracion"
                style={{ color: '#FF6A1A', fontWeight: 700, textDecoration: 'none' }}
              >
                Completar configuración →
              </a>
            </span>
          </div>
        )}

        {/* Grace period warning banner */}
        {showGraceBanner && subscriptionInfo && (
          <div
            style={{
              background: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontFamily: 'var(--font-sans, sans-serif)',
              fontSize: 13,
              color: '#92400e',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1 }}>
              <strong>
                Tu suscripción venció el{' '}
                {subscriptionInfo.endDate?.toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                .
              </strong>{' '}
              Tenés{' '}
              <strong>
                {subscriptionInfo.graceDaysLeft}{' '}
                {subscriptionInfo.graceDaysLeft === 1 ? 'día hábil' : 'días hábiles'}
              </strong>{' '}
              para regularizar el pago. Contactá a soporte para renovar.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
      <Toaster />
      <ConfirmDialog />
    </div>
  );
}
