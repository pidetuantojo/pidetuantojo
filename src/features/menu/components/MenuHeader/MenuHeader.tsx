import type { Restaurant, OpeningHours } from '@/types';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = 'var(--font-space-mono, monospace)';

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtHour(t: string) {
  let [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'a.m.' : 'p.m.';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
function getMenuStatus(openingHours?: OpeningHours): { open: boolean; label: string } | null {
  if (!openingHours) return null;
  const anyDefined = Object.values(openingHours).some((v) => v !== null && v !== undefined);
  if (!anyDefined) return null;

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

interface MenuHeaderProps {
  restaurant: Restaurant;
  cartCount: number;
  onNavOpen: () => void;
  onCartOpen: () => void;
}

export function MenuHeader({ restaurant, cartCount, onNavOpen, onCartOpen }: MenuHeaderProps) {
  const { name, tagline, description, logo, bannerImage, theme, openingHours } = restaurant;
  const { primaryColor: pri, secondaryColor: sec, accentColor: acc, bgColor } = theme;
  const bg = bgColor ?? '#FBF8F5';
  const subtitle = tagline || description;

  return (
    <div style={{ position: 'relative' }}>
      {/* Cover photo */}
      <div
        style={{
          position: 'relative',
          height: 240,
          overflow: 'hidden',
          background: `linear-gradient(135deg, color-mix(in srgb, ${pri} 70%, #000 6%), ${sec})`,
        }}
      >
        {bannerImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url('${bannerImage}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* Scrim top→bottom */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 60%, color-mix(in srgb, ${bg} 92%, transparent) 100%)`,
          }}
        />
      </div>

      {/* Floating top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
        }}
      >
        <button
          onClick={onNavOpen}
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.5)',
            background: 'rgba(255,255,255,.22)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,.15)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <button
          onClick={onCartOpen}
          style={{
            position: 'relative',
            width: 42,
            height: 42,
            borderRadius: 13,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.5)',
            background: 'rgba(255,255,255,.22)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,.15)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
          {cartCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                minWidth: 19,
                height: 19,
                padding: '0 5px',
                borderRadius: 999,
                background: pri,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
                fontFamily: sg,
                border: '1.5px solid #fff',
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Hero card — lifts over cover */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          margin: '-64px 16px 0',
          background: '#fff',
          borderRadius: 26,
          padding: '0 24px 24px',
          boxShadow: '0 18px 40px -22px rgba(0,0,0,.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Logo circle */}
          <div
            style={{
              marginTop: -54,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: '#fff',
              padding: 6,
              boxShadow: '0 10px 26px -8px rgba(0,0,0,.3)',
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid #f2ede7',
              }}
            >
              {logo ? (
                <img
                  src={logo}
                  alt={name}
                  style={{ width: '65%', height: '65%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontWeight: 700, fontSize: 36, color: pri, fontFamily: sg }}>
                  {name[0]?.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <h1
            style={{
              fontFamily: sg,
              fontWeight: 700,
              fontSize: 27,
              letterSpacing: '-.02em',
              color: sec,
              margin: '14px 0 0',
            }}
          >
            {name}
          </h1>

          {subtitle && (
            <p
              style={{
                fontFamily: sg,
                fontSize: 14,
                lineHeight: 1.5,
                color: '#7a7269',
                margin: '8px 0 0',
                maxWidth: 270,
              }}
            >
              {subtitle}
            </p>
          )}

          {(() => {
            const status = getMenuStatus(openingHours);
            if (!status) return null;
            const todaySchedule = openingHours?.[new Date().getDay()];
            return (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Pill abierto/cerrado */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: sm,
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '7px 14px',
                    alignSelf: 'flex-start',
                    color: status.open ? pri : '#8a7f76',
                    background: status.open ? acc : '#EDE7E0',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.open ? pri : '#b3a89e', display: 'inline-block' }} />
                  {status.open ? 'ABIERTO' : 'CERRADO'} · {status.label}
                </div>
                {/* Horario del día */}
                {todaySchedule && (
                  <div style={{ fontFamily: sm, fontSize: 10.5, color: '#a89e95', paddingLeft: 2 }}>
                    Hoy: {fmtHour(todaySchedule.open)} – {fmtHour(todaySchedule.close)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
