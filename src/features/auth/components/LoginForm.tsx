'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '@/constants/routes';
import { AppLoader } from '@/components/ui/AppLoader';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

function AntojoBiteLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={className}>
      <defs>
        <linearGradient id="bite-g" x1="102" y1="102" x2="922" y2="922" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFB02E" />
          <stop offset="0.55" stopColor="#FF6A1A" />
          <stop offset="1" stopColor="#EA3B2E" />
        </linearGradient>
        <mask id="bite-m">
          <rect width="1024" height="1024" fill="#fff" />
          <circle cx="819.2" cy="215" r="307.2" fill="#000" />
        </mask>
      </defs>
      <circle cx="512" cy="512" r="512" fill="url(#bite-g)" mask="url(#bite-m)" />
    </svg>
  );
}

export function LoginForm() {
  const { signIn, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      setShowLoader(true);
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  if (showLoader || user) {
    if (user) {
      const dest = user.role === 'super_admin' ? ROUTES.admin.restaurants : ROUTES.dashboard.root;
      router.replace(dest);
    }
    return <AppLoader theme="dark" message="Preparando tu panel" />;
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 14,
    backdropFilter: 'blur(8px)',
  };

  return (
    <div style={{ fontFamily: sg }} className="flex min-h-screen">

      {/* ── Panel izquierdo (branding) ── */}
      <div
        className="relative hidden lg:flex lg:w-[520px] flex-shrink-0 flex-col justify-between overflow-hidden"
        style={{
          padding: '44px 46px',
          background: 'radial-gradient(130% 100% at 15% 0%, #3a2417 0%, #1B1512 55%)',
        }}
      >
        {/* Orange glow — top-right, partially outside */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 420, height: 420, right: -150, top: -120,
            background: 'radial-gradient(circle, rgba(255,106,26,.55), transparent 65%)',
            filter: 'blur(20px)',
          }}
        />
        {/* Amber glow — bottom-left, partially outside */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 300, height: 300, left: -120, bottom: -90,
            background: 'radial-gradient(circle, rgba(251,169,22,.3), transparent 65%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <AntojoBiteLogo className="h-9 w-9" />
          <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: '#FBF6F1' }}>
            Antojo<span style={{ color: '#FF6A1A' }}>.</span>
          </span>
        </div>

        {/* Tagline + pills */}
        <div className="relative">
          <h2 style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.22, letterSpacing: '-0.02em', color: '#FBF6F1', margin: '0 0 16px' }}>
            Tu restaurante,<br />en una sola pantalla.
          </h2>
          <div className="flex flex-wrap gap-2">
            {['Menús digitales', 'Pedidos en vivo', 'Contabilidad'].map((pill) => (
              <span
                key={pill}
                style={{
                  fontFamily: sm,
                  fontSize: 11,
                  color: '#fff',
                  background: 'rgba(255,255,255,.14)',
                  border: '1px solid rgba(255,255,255,.22)',
                  borderRadius: 999,
                  padding: '6px 12px',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Stats decorativos */}
        <div className="relative flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1" style={{ ...glassCard, padding: '14px 16px' }}>
              <p style={{ fontFamily: sm, fontSize: 10, color: '#c9a78f', margin: '0 0 6px' }}>VENTAS HOY</p>
              <p style={{ fontWeight: 700, fontSize: 24, color: '#fff', margin: 0 }}>$84.250</p>
              <p style={{ fontFamily: sm, fontSize: 10, color: '#7BD88F', margin: '3px 0 0' }}>▲ 12% vs ayer</p>
            </div>
            <div className="flex-1" style={{ ...glassCard, padding: '14px 16px' }}>
              <p style={{ fontFamily: sm, fontSize: 10, color: '#c9a78f', margin: '0 0 6px' }}>EN COCINA</p>
              <p style={{ fontWeight: 700, fontSize: 24, color: '#fff', margin: 0 }}>7</p>
              <p style={{ fontFamily: sm, fontSize: 10, color: '#FFB02E', margin: '3px 0 0' }}>2 por demorarse</p>
            </div>
          </div>

          {/* Order preview card */}
          <div className="flex items-center gap-3" style={{ ...glassCard, padding: '12px 16px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'linear-gradient(135deg, #FFB02E, #EA3B2E)' }} />
            <div className="flex-1 min-w-0">
              <p style={{ fontWeight: 600, fontSize: 13, color: '#fff', margin: 0 }}>Mesa 12 · Milanesa napolitana</p>
              <p style={{ fontFamily: sm, fontSize: 10, color: '#b8aaa0', margin: 0 }}>Pedido #1043 · hace 2 min</p>
            </div>
            <div style={{ fontFamily: sm, fontSize: 10, color: '#1B1512', background: '#7BD88F', borderRadius: 999, padding: '4px 9px', fontWeight: 700, flexShrink: 0 }}>
              LISTO
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel derecho (formulario) ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-14 py-12" style={{ background: '#FBF8F5' }}>

        {/* Logo mobile */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <AntojoBiteLogo className="h-8 w-8" />
          <span style={{ fontWeight: 700, fontSize: 19, color: '#1B1512' }}>
            Antojo<span style={{ color: '#FF6A1A' }}>.</span>
          </span>
        </div>

        <div className="w-full max-w-[360px]">
          <h1 style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', color: '#1B1512', margin: '0 0 6px' }}>
            Ingresá a tu cuenta
          </h1>
          <p style={{ fontSize: 14, color: '#8a7f76', margin: '0 0 30px' }}>
            Gestioná tu local desde donde estés.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 500, fontSize: 13, color: '#5a5048', display: 'block', marginBottom: 7 }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="hola@turestaurante.com"
                style={{ fontFamily: sg, fontSize: 15, color: '#1B1512', width: '100%', border: '1.5px solid #E7DED6', background: '#fff', borderRadius: 12, padding: '14px 16px', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
                onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; e.target.style.boxShadow = '0 0 0 4px rgba(255,106,26,.13)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 7 }}>
                <label style={{ fontWeight: 500, fontSize: 13, color: '#5a5048' }}>Contraseña</label>
                <button type="button" style={{ fontFamily: sg, fontSize: 12, color: '#FF6A1A', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 999 }}>
                  ¿La olvidaste?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ fontFamily: sg, fontSize: 15, color: '#1B1512', width: '100%', border: '1.5px solid #E7DED6', background: '#fff', borderRadius: 12, padding: '14px 16px', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
                onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; e.target.style.boxShadow = '0 0 0 4px rgba(255,106,26,.13)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer" style={{ marginBottom: 24 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: 'linear-gradient(135deg, #FF8A2B, #EA3B2E)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: '#5a5048' }}>Mantener sesión iniciada</span>
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600" style={{ marginBottom: 16 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                fontFamily: sg, fontWeight: 600, fontSize: 15, color: '#fff',
                width: '100%', border: 0, borderRadius: 999, padding: 15, cursor: 'pointer',
                background: 'linear-gradient(135deg, #FF8A2B, #FF6A1A 55%, #EA3B2E)',
                boxShadow: '0 8px 22px -6px rgba(234,59,46,.5)',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity .15s',
              }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: '#8a7f76', textAlign: 'center', margin: '26px 0 0' }}>
            ¿No tenés cuenta?{' '}
            <a href="/registrar-local" style={{ color: '#FF6A1A', textDecoration: 'none', fontWeight: 600 }}>
              Registrá tu local
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
