import type { Restaurant } from '@/types';

interface ComingSoonProps {
  restaurant: Pick<Restaurant, 'name' | 'logo' | 'theme'>;
}

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';

export function ComingSoon({ restaurant }: ComingSoonProps) {
  const { name, logo, theme } = restaurant;
  const pri = theme.primaryColor;
  const sec = theme.secondaryColor;
  const bg = theme.bgColor ?? '#FBF3E9';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        fontFamily: sg,
      }}
    >
      {/* Logo / inicial */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: logo ? '#fff' : `${pri}20`,
          border: `3px solid ${pri}33`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          flexShrink: 0,
          boxShadow: '0 8px 24px -8px rgba(0,0,0,.18)',
        }}
      >
        {logo ? (
          <img src={logo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 42, fontWeight: 700, color: pri, fontFamily: sg }}>
            {name[0]?.toUpperCase()}
          </span>
        )}
      </div>

      {/* Nombre */}
      <h1
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: sec,
          letterSpacing: '-.02em',
          margin: 0,
          textAlign: 'center',
        }}
      >
        {name}
      </h1>

      {/* Pill "Próximamente" */}
      <div
        style={{
          marginTop: 22,
          background: `${pri}18`,
          border: `1px solid ${pri}44`,
          borderRadius: 999,
          padding: '9px 22px',
          fontFamily: sm,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: pri,
        }}
      >
        Próximamente
      </div>

      {/* Subtítulo */}
      <p
        style={{
          marginTop: 18,
          fontSize: 15,
          color: '#7a7269',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.65,
        }}
      >
        Estamos preparando nuestro menú. ¡Vuelve pronto!
      </p>

      {/* Footer */}
      <p
        style={{
          position: 'fixed',
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: sm,
          fontSize: 10,
          letterSpacing: '.08em',
          color: '#a89e95',
          margin: 0,
        }}
      >
        HECHO CON PIDE TU ANTOJO
      </p>
    </div>
  );
}
