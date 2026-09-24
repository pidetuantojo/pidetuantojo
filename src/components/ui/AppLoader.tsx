'use client';

import { LogoMark } from './Logo';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

const THEMES = {
  light: {
    bg: '#FBF8F5',
    glow: 'radial-gradient(circle, rgba(255,150,60,.16), transparent 68%)',
    ring: '#FF6A1A',
    ring2: '#FBA916',
    titleColor: '#1B1512',
    msgColor: '#8a7f76',
  },
  dark: {
    bg: 'radial-gradient(130% 100% at 50% 0%, #3a2417, #1B1512 60%)',
    glow: 'radial-gradient(circle, rgba(255,106,26,.28), transparent 66%)',
    ring: '#FF8A2B',
    ring2: '#FBA916',
    titleColor: '#FBF6F1',
    msgColor: '#b8aaa0',
  },
  warm: {
    bg: 'linear-gradient(135deg, #FF8A2B, #FF6A1A 50%, #EA3B2E)',
    glow: 'radial-gradient(circle, rgba(255,220,150,.35), transparent 66%)',
    ring: '#FFFFFF',
    ring2: 'rgba(255,255,255,.6)',
    titleColor: '#fff',
    msgColor: 'rgba(255,255,255,.9)',
  },
} as const;


interface AppLoaderProps {
  theme?: 'light' | 'dark' | 'warm';
  message?: string;
}

export function AppLoader({ theme = 'dark', message = 'Cargando' }: AppLoaderProps) {
  const t = THEMES[theme];
  const ringMask = 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))';
  const ring2Mask = 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[30px] overflow-hidden"
      style={{ fontFamily: sg, background: t.bg }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ width: 520, height: 520, background: t.glow, filter: 'blur(30px)', opacity: 0.9 }}
      />

      {/* Logo + rings — 132×132 container */}
      <div className="relative" style={{ width: 132, height: 132, display: 'grid', placeItems: 'center' }}>

        {/* Outer spinning arc (conic-gradient + mask) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${t.ring} 300deg, transparent 340deg)`,
            WebkitMask: ringMask,
            mask: ringMask,
            animation: 'antojo-spin 1.1s linear infinite',
          }}
        />

        {/* Inner counter-rotating arc */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 16,
            background: `conic-gradient(from 180deg, transparent 0deg, ${t.ring2} 120deg, transparent 180deg)`,
            WebkitMask: ring2Mask,
            mask: ring2Mask,
            animation: 'antojo-spin-rev 1.8s linear infinite',
          }}
        />

        {/* Breathing logo */}
        <div style={{ animation: 'antojo-breathe 1.6s ease-in-out infinite' }}>
          <LogoMark style={{ width: 60, height: 60, color: '#FF6A1A' }} />
        </div>
      </div>

      {/* Wordmark + message */}
      <div style={{ textAlign: 'center', animation: 'antojo-fade .5s ease both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-logo)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.03em', lineHeight: 1.02, color: t.titleColor }}>
          <span>Pide tu</span>
          <span>antojo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ fontFamily: sm, fontSize: 12, letterSpacing: '.04em', color: t.msgColor }}>
            {message}
          </span>
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[0, 0.2, 0.4].map((delay) => (
              <span
                key={delay}
                style={{
                  width: 4, height: 4, borderRadius: '50%', background: '#FF6A1A',
                  animation: `antojo-dot 1.4s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
