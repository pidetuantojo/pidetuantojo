'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Restaurant, OpeningHours } from '@/types';
import { Select } from '@/components/ui/Select';

// ─── helpers ────────────────────────────────────────────────────────────────

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtHour(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'a.m.' : 'p.m.';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
function getStatus(openingHours?: OpeningHours): { open: boolean; label: string } {
  if (!openingHours) return { open: false, label: 'Sin horario' };
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = openingHours[day];
  const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  if (today) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    const overnight = c <= o;
    const isOpen = overnight ? (mins >= o || mins < c) : (mins >= o && mins < c);
    if (isOpen) return { open: true, label: `Cierra ${fmtHour(today.close)}` };
    if (mins < o) return { open: false, label: `Abre hoy ${fmtHour(today.open)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const next = openingHours[d];
    if (next) {
      const when = i === 1 ? 'mañana' : DAY_NAMES[d];
      return { open: false, label: `Abre ${when} ${fmtHour(next.open)}` };
    }
  }
  return { open: false, label: 'Cerrado' };
}

// ─── logo svg ───────────────────────────────────────────────────────────────

function BiteLogo({ size = 28, white = false }: { size?: number; white?: boolean }) {
  if (white) {
    return (
      <svg viewBox="0 0 1024 1024" width={size} height={size}>
        <defs>
          <mask id="hb-mw">
            <rect width="1024" height="1024" fill="#fff" />
            <circle cx="819.2" cy="215" r="307.2" fill="#000" />
          </mask>
        </defs>
        <circle cx="512" cy="512" r="512" fill="#fff" mask="url(#hb-mw)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size}>
      <defs>
        <linearGradient id="hb-g" x1="102" y1="102" x2="922" y2="922" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFB02E" />
          <stop offset="0.55" stopColor="#FF6A1A" />
          <stop offset="1" stopColor="#EA3B2E" />
        </linearGradient>
        <mask id="hb-m">
          <rect width="1024" height="1024" fill="#fff" />
          <circle cx="819.2" cy="215" r="307.2" fill="#000" />
        </mask>
      </defs>
      <circle cx="512" cy="512" r="512" fill="url(#hb-g)" mask="url(#hb-m)" />
    </svg>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────

interface HomeClientProps {
  restaurants: Restaurant[];
}

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

// ─── component ───────────────────────────────────────────────────────────────

export function HomeClient({ restaurants }: HomeClientProps) {
  const [dep, setDep] = useState('');
  const [city, setCity] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);

  // Derivar opciones de los propios restaurantes
  const depOptions = useMemo(() => {
    const deps = Array.from(new Set(restaurants.map((r) => r.department).filter(Boolean) as string[])).sort();
    return [{ value: '', label: 'Todos los departamentos' }, ...deps.map((d) => ({ value: d, label: d }))];
  }, [restaurants]);

  const cityOptions = useMemo(() => {
    const cities = Array.from(
      new Set(
        restaurants
          .filter((r) => !dep || r.department === dep)
          .map((r) => r.city)
          .filter(Boolean) as string[]
      )
    ).sort();
    return [{ value: '', label: 'Todas las ciudades' }, ...cities.map((c) => ({ value: c, label: c }))];
  }, [restaurants, dep]);

  const catOptions = useMemo(() => {
    const cats = Array.from(new Set(restaurants.map((r) => r.category).filter(Boolean) as string[])).sort();
    return [{ value: '', label: 'Todas las categorías' }, ...cats.map((c) => ({ value: c, label: c }))];
  }, [restaurants]);

  function handleDepChange(val: string) {
    setDep(val);
    setCity('');
  }

  // Lista filtrada + estado calculado
  const filtered = useMemo(() => {
    const qLow = q.trim().toLowerCase();
    return restaurants
      .map((r) => ({ r, st: getStatus(r.openingHours) }))
      .filter(({ r, st }) => {
        if (dep && r.department !== dep) return false;
        if (city && r.city !== city) return false;
        if (cat && r.category !== cat) return false;
        if (onlyOpen && !st.open) return false;
        if (qLow && ![r.name, r.tagline ?? '', r.category ?? '', r.description].join(' ').toLowerCase().includes(qLow)) return false;
        return true;
      })
      .sort((a, b) => (b.st.open ? 1 : 0) - (a.st.open ? 1 : 0));
  }, [restaurants, dep, city, cat, onlyOpen, q]);

  const locLabel = city || dep || 'Todo el país';
  const resultsTitle = city
    ? `Restaurantes en ${city}`
    : dep
    ? `Restaurantes en ${dep}`
    : 'Todos los restaurantes';

  return (
    <>
      {/* ── estilos globales de la página ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; background: #FBF8F5; }
        .rcard { transition: transform .18s, box-shadow .18s; cursor: pointer; }
        .rcard:hover { transform: translateY(-4px); box-shadow: 0 22px 46px -24px rgba(27,21,18,.42) !important; }
        .srch { font-family: var(--font-space-grotesk,'Inter',sans-serif); font-size: 14px; color: #1B1512; width: 100%; border: 1.5px solid #E7DED6; background: #fff; border-radius: 13px; padding: 13px 16px 13px 44px; outline: none; }
        .srch::placeholder { color: #a89e95; }
        .srch:focus { border-color: #FF6A1A; box-shadow: 0 0 0 4px rgba(255,106,26,.12); }
        .srch-sm { flex: 1; border: 0; outline: none; font-family: var(--font-space-grotesk,'Inter',sans-serif); font-size: 13.5px; color: #1B1512; background: none; }
        @media (max-width: 767px) { .desktop-only { display: none !important; } }
        @media (min-width: 768px) { .mobile-only { display: none !important; } }
      ` }} />

      {/* ══════════════════════════════════════════════════════════
          DESKTOP LAYOUT
      ═══════════════════════════════════════════════════════════ */}
      <div className="desktop-only" style={{ minHeight: '100vh', background: '#FBF8F5', fontFamily: sg }}>

        {/* NAV */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28,
          padding: '16px 40px',
          background: 'rgba(251,248,245,.88)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #EFE7DF',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
            <BiteLogo size={30} />
            <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: '#1B1512', lineHeight: 1.05 }}>
              Pide Tu<br />Antojo<span style={{ color: '#FF6A1A' }}>.</span>
            </div>
          </div>

          <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a89e95" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 15, top: 14, pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            <input className="srch" placeholder="Buscar restaurante o comida..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: sg, fontSize: 13, color: '#5a5048', background: '#fff', border: '1.5px solid #E7DED6', borderRadius: 12, padding: '11px 15px' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {locLabel}
            </div>
            <Link href="/login" style={{
              fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#fff',
              border: 0, borderRadius: 12, padding: '12px 20px',
              cursor: 'pointer', textDecoration: 'none',
              background: 'linear-gradient(135deg,#FF8A2B,#FF6A1A 55%,#EA3B2E)',
              boxShadow: '0 8px 20px -8px rgba(234,59,46,.5)',
            }}>
              Registrá tu local
            </Link>
          </div>
        </div>

        {/* HERO
            El outer div NO tiene overflow:hidden para que los dropdowns del custom Select
            puedan renderizarse fuera sin cortarse. Los elementos decorativos (watermark,
            glow) se clipean con un inner div absoluto que sí tiene overflow:hidden. */}
        <div style={{ position: 'relative', margin: '24px 40px 0', borderRadius: 24, background: 'linear-gradient(115deg,#FF8A2B,#FF6A1A 48%,#EA3B2E)' }}>
          {/* Capa decorativa con overflow:hidden — solo clipea el watermark y el glow */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', right: -40, top: -60, opacity: .13 }}>
              <BiteLogo size={340} white />
            </div>
          </div>

          {/* Contenido — sin overflow:hidden para que los dropdowns salgan bien */}
          <div style={{ position: 'relative', padding: '44px 46px 40px' }}>
            <div style={{ fontFamily: sm, fontSize: 12, letterSpacing: '.12em', color: 'rgba(255,255,255,.85)', marginBottom: 10 }}>
              {restaurants.length} RESTAURANTES REGISTRADOS
            </div>
            <h1 style={{ fontFamily: sg, fontWeight: 700, fontSize: 44, lineHeight: 1.08, letterSpacing: '-.03em', color: '#fff', margin: '0 0 12px', maxWidth: 620 }}>
              ¿Qué se te antoja hoy?
            </h1>
            <p style={{ fontFamily: sg, fontSize: 16, lineHeight: 1.55, color: 'rgba(255,255,255,.92)', margin: '0 0 26px', maxWidth: 520 }}>
              Encontrá los restaurantes de tu ciudad, mirá su menú y pedí directo por WhatsApp.
            </p>

            {/* FILTERS — custom Select con z-index alto para que el dropdown salga por encima */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 18, padding: 16, backdropFilter: 'blur(14px)', maxWidth: 900, position: 'relative', zIndex: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#fff', marginBottom: 7 }}>DEPARTAMENTO</div>
                <Select value={dep} onChange={handleDepChange} options={depOptions} placeholder="Todos" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#fff', marginBottom: 7 }}>CIUDAD</div>
                <Select value={city} onChange={setCity} options={cityOptions} placeholder="Todas" disabled={!dep} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#fff', marginBottom: 7 }}>CATEGORÍA</div>
                <Select value={cat} onChange={setCat} options={catOptions} placeholder="Todas" />
              </div>
              <button
                onClick={() => setOnlyOpen((o) => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
                  fontFamily: sg, fontWeight: 600, fontSize: 13, borderRadius: 12,
                  padding: '13px 17px', cursor: 'pointer', border: 'none',
                  transition: 'background .15s',
                  color: onlyOpen ? '#EA3B2E' : '#fff',
                  background: onlyOpen ? '#fff' : 'rgba(255,255,255,.18)',
                  outline: onlyOpen ? 'none' : '1px solid rgba(255,255,255,.34)',
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 5, display: 'inline-block', background: onlyOpen ? '#EA3B2E' : 'rgba(0,0,0,.18)' }} />
                Solo abiertos
              </button>
            </div>
          </div>
        </div>

        {/* RESULTS */}
        <div style={{ padding: '30px 40px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontFamily: sg, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>{resultsTitle}</h2>
            <span style={{ fontFamily: sm, fontSize: 12, color: '#8a7f76' }}>{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px dashed #E0D6CC', borderRadius: 18 }}>
              <div style={{ marginBottom: 16, opacity: .3 }}><BiteLogo size={56} /></div>
              <div style={{ fontFamily: sg, fontWeight: 600, fontSize: 18, color: '#1B1512', marginBottom: 6 }}>Todavía no hay restaurantes acá</div>
              <div style={{ fontFamily: sg, fontSize: 14, color: '#8a7f76' }}>Probá con otra ciudad o quitá algún filtro.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
              {filtered.map(({ r, st }) => (
                <DesktopCard key={r.id} restaurant={r} st={st} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE LAYOUT
      ═══════════════════════════════════════════════════════════ */}
      <div className="mobile-only" style={{ minHeight: '100vh', background: '#FBF8F5', fontFamily: sg }}>

        {/* HEADER — gradiente con padding-bottom generoso para que la card lo solape */}
        <div style={{ position: 'relative', background: 'linear-gradient(150deg,#FF8A2B,#FF6A1A 50%,#EA3B2E)', padding: '48px 20px 72px', overflow: 'hidden' }}>
          {/* Watermark decorativo */}
          <div style={{ position: 'absolute', right: -50, top: -30, opacity: .12, pointerEvents: 'none' }}>
            <BiteLogo size={220} white />
          </div>

          {/* Nav row */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <BiteLogo size={28} white />
              <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 16, color: '#fff', lineHeight: 1.05, letterSpacing: '-.01em' }}>
                Pide Tu<br />Antojo<span style={{ color: 'rgba(255,255,255,.7)' }}>.</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: sg, fontWeight: 600, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '8px 13px' }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {locLabel}
            </div>
          </div>

          {/* Título */}
          <h2 style={{ position: 'relative', fontFamily: sg, fontWeight: 700, fontSize: 30, lineHeight: 1.1, letterSpacing: '-.025em', color: '#fff', margin: '0 0 18px' }}>
            ¿Qué se te<br />antoja hoy?
          </h2>

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14, padding: '13px 16px', boxShadow: '0 10px 28px -10px rgba(0,0,0,.35)' }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#a89e95" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input className="srch-sm" placeholder="Buscar restaurante o comida..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {/* CARD de filtros + lista — sube sobre el header con margin-top negativo */}
        <div style={{ margin: '-36px 0 0', borderRadius: '24px 24px 0 0', background: '#FBF8F5', minHeight: '100vh', position: 'relative', zIndex: 2 }}>

          {/* FILTROS */}
          <div style={{ padding: '22px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Dep + Ciudad — apilados verticalmente, ciudad solo aparece si hay dep */}
            <div>
              <div style={{ fontFamily: sm, fontSize: 9.5, letterSpacing: '.08em', color: '#9a8f86', marginBottom: 6 }}>DEPARTAMENTO</div>
              <Select value={dep} onChange={handleDepChange} options={depOptions} placeholder="Todos los departamentos" />
            </div>
            {dep && (
              <div>
                <div style={{ fontFamily: sm, fontSize: 9.5, letterSpacing: '.08em', color: '#9a8f86', marginBottom: 6 }}>CIUDAD</div>
                <Select value={city} onChange={setCity} options={cityOptions} placeholder="Todas las ciudades" />
              </div>
            )}

            {/* Chips de categoría */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0 4px' }}>
              {catOptions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCat(c.value)}
                  style={{
                    flexShrink: 0, fontFamily: sg, fontWeight: 600, fontSize: 12.5,
                    borderRadius: 999, padding: '9px 16px', cursor: 'pointer',
                    border: cat === c.value ? 'none' : '1.5px solid #E7DED6',
                    color: cat === c.value ? '#fff' : '#5a5048',
                    background: cat === c.value ? '#FF6A1A' : '#fff',
                    boxShadow: cat === c.value ? '0 4px 12px -4px rgba(255,106,26,.5)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Solo abiertos */}
            <button
              onClick={() => setOnlyOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: sg, fontWeight: 600, fontSize: 13,
                borderRadius: 13, padding: '13px 16px', cursor: 'pointer',
                border: onlyOpen ? '1.5px solid #FFC9A8' : '1.5px solid #E7DED6',
                color: onlyOpen ? '#EA3B2E' : '#5a5048',
                background: onlyOpen ? '#FFF1E9' : '#fff',
                transition: 'all .15s',
                textAlign: 'left',
              }}
            >
              {/* Switch visual */}
              <span style={{
                width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                display: 'flex', alignItems: 'center', padding: 3,
                background: onlyOpen ? '#EA3B2E' : '#D8D0C8',
                transition: 'background .2s',
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  transform: onlyOpen ? 'translateX(16px)' : 'translateX(0)',
                  transition: 'transform .2s', display: 'block',
                }} />
              </span>
              Solo abiertos
            </button>
          </div>

          {/* LISTA */}
          <div style={{ padding: '20px 16px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 17, color: '#1B1512' }}>{resultsTitle}</span>
              <span style={{ fontFamily: sm, fontSize: 11, color: '#8a7f76' }}>
                {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', border: '1px dashed #E0D6CC', borderRadius: 16 }}>
                <div style={{ fontFamily: sg, fontWeight: 600, fontSize: 15, color: '#1B1512', marginBottom: 5 }}>Sin restaurantes acá</div>
                <div style={{ fontFamily: sg, fontSize: 13, color: '#8a7f76' }}>Probá otra ciudad o quitá un filtro.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(({ r, st }) => (
                  <MobileCard key={r.id} restaurant={r} st={st} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Desktop Card ─────────────────────────────────────────────────────────────

function DesktopCard({ restaurant: r, st }: { restaurant: Restaurant; st: { open: boolean; label: string } }) {
  const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
  const sm = "var(--font-space-mono, monospace)";
  const pri = r.theme.primaryColor;
  const sec = r.theme.secondaryColor;

  return (
    <Link href={`/${r.slug}`} style={{ textDecoration: 'none' }}>
      <div className="rcard" style={{ background: '#fff', border: '1px solid #EFE7DF', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px -20px rgba(27,21,18,.4)' }}>
        {/* Cover */}
        <div style={{ position: 'relative', height: 158 }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: r.bannerImage
              ? `url('${r.bannerImage}') center/cover no-repeat`
              : `linear-gradient(135deg,${pri},${sec})`,
            filter: st.open ? 'none' : 'saturate(.55)',
          }} />
          {!r.bannerImage && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: sg, fontWeight: 700, fontSize: 58, color: 'rgba(255,255,255,.9)', letterSpacing: '-.03em' }}>
              {r.name.charAt(0)}
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.22),rgba(0,0,0,0) 45%,rgba(0,0,0,.28))' }} />
          <span style={{
            position: 'absolute', top: 12, right: 12,
            fontFamily: sm, fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em',
            borderRadius: 999, padding: '5px 11px',
            color: st.open ? '#14331F' : '#fff',
            background: st.open ? '#7BD88F' : 'rgba(27,21,18,.72)',
            border: st.open ? 'none' : '1px solid rgba(255,255,255,.24)',
          }}>
            {st.open ? 'ABIERTO' : 'CERRADO'}
          </span>
          {r.category && (
            <span style={{ position: 'absolute', bottom: 12, left: 12, fontFamily: sm, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.42)', border: '1px solid rgba(255,255,255,.28)', backdropFilter: 'blur(6px)', borderRadius: 999, padding: '5px 11px' }}>
              {r.category}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px 18px', position: 'relative' }}>
          {/* Logo bubble */}
          <div style={{ position: 'absolute', top: -26, right: 18, width: 50, height: 50, borderRadius: '50%', background: '#fff', padding: 4, boxShadow: '0 6px 16px -6px rgba(0,0,0,.3)' }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: r.logo ? `#fff url('${r.logo}') center/contain no-repeat` : `linear-gradient(135deg,${pri},${sec})`,
            }} />
          </div>

          <h3 style={{ fontFamily: sg, fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', color: '#1B1512', margin: '0 0 4px', paddingRight: 44 }}>
            {r.name}
          </h3>
          <p style={{ fontFamily: sg, fontSize: 13, lineHeight: 1.45, color: '#8a7f76', margin: '0 0 14px', paddingRight: 44, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {r.tagline || r.description}
          </p>

          {(r.city || r.department) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: sm, fontSize: 11, color: '#8a7f76', marginBottom: 6 }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#c0b5ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {[r.city, r.department].filter(Boolean).join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 10, borderTop: '1px solid #F1EAE3' }}>
            <span style={{ fontFamily: sm, fontSize: 11, color: st.open ? '#2C7A52' : '#a89e95' }}>
              {st.label}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: sg, fontWeight: 700, fontSize: 13, color: '#FF6A1A' }}>
              Ver menú
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function MobileCard({ restaurant: r, st }: { restaurant: Restaurant; st: { open: boolean; label: string } }) {
  const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
  const sm = "var(--font-space-mono, monospace)";
  const pri = r.theme.primaryColor;
  const sec = r.theme.secondaryColor;

  return (
    <Link href={`/${r.slug}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#fff', border: '1px solid #EFE7DF', borderRadius: 18, padding: 14, boxShadow: '0 6px 18px -16px rgba(27,21,18,.4)', cursor: 'pointer' }}>
        <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
          {/* Logo square */}
          <div style={{ width: 56, height: 56, borderRadius: 15, overflow: 'hidden', flexShrink: 0, border: '1px solid #F1EAE3' }}>
            <div style={{
              width: '100%', height: '100%',
              background: r.logo ? `#fff url('${r.logo}') center/contain no-repeat` : `linear-gradient(135deg,${pri},${sec})`,
              display: 'grid', placeItems: 'center',
              fontFamily: sg, fontWeight: 700, fontSize: 20, color: 'rgba(255,255,255,.95)',
            }}>
              {!r.logo && r.name.charAt(0)}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <h4 style={{ fontFamily: sg, fontWeight: 700, fontSize: 16, letterSpacing: '-.01em', color: '#1B1512', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.name}
              </h4>
              <span style={{
                flexShrink: 0, fontFamily: sm, fontSize: 8.5, fontWeight: 700, letterSpacing: '.05em',
                borderRadius: 999, padding: '4px 8px',
                color: st.open ? '#1F5130' : '#8a7f76',
                background: st.open ? '#D9F2E2' : '#EDE7E0',
              }}>
                {st.open ? 'ABIERTO' : 'CERRADO'}
              </span>
            </div>

            {r.category && (
              <div style={{ fontFamily: sg, fontSize: 12, color: '#9a9088', marginBottom: 8 }}>{r.category}</div>
            )}

            {(r.city || r.department) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: sg, fontSize: 11.5, color: '#8a7f76', marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#c0b5ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[r.city, r.department].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#c0b5ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <span style={{ fontFamily: sm, fontSize: 10, color: st.open ? '#2C7A52' : '#a89e95' }}>
                {st.label}
              </span>
            </div>
          </div>

          <span style={{
            width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 11,
            color: st.open ? '#FF6A1A' : '#b3a89e',
            background: st.open ? '#FFF1E9' : '#F4EFE9',
          }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
