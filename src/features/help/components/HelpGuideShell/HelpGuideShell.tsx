'use client';

import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';

import { HELP_GUIDES, HELP_SECTIONS } from '../../content/registry';
import { visibleGuides } from '../../helpers/help.helpers';
import type { HelpGuide } from '../../types/help.types';

const SOPORTE_WA_URL = 'https://wa.me/PENDIENTE?text=Hola%2C%20necesito%20ayuda%20con%20Pide%20Tu%20Antojo';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";
const ORANGE = '#FF6A1A';

const pill: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
  background: 'var(--t-surface-2)', color: 'var(--t-text-2)', border: '1px solid var(--t-border)',
};

/** Marco de una guía: migas, título, etiquetas, control de permiso y guías relacionadas. */
export function HelpGuideShell({ guide, children }: { guide: HelpGuide; children: React.ReactNode }) {
  const { can } = useAuth();
  const section = HELP_SECTIONS.find((s) => s.slug === guide.section);
  const allowed = !guide.permission || can(guide.permission);
  const related = visibleGuides(HELP_GUIDES, can).filter((g) => g.section === guide.section && g.slug !== guide.slug);

  return (
    <article style={{ fontFamily: sg, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={ROUTES.dashboard.ayuda}
          aria-label="Volver al centro de ayuda"
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10,
            border: '1px solid var(--t-border)', background: 'var(--t-surface)',
            display: 'grid', placeItems: 'center', color: 'var(--t-text-2)',
            textDecoration: 'none', transition: 'background .15s, color .15s',
          }}
          className="hover:bg-[var(--t-surface-2)] hover:text-[var(--t-text-1)]"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <nav aria-label="Ruta" style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href={ROUTES.dashboard.ayuda} style={{ color: 'inherit' }}>Ayuda</Link>
          <span aria-hidden>›</span>
          <span>{section?.title}</span>
        </nav>
      </div>

      <h1 style={{ margin: '4px 0 0', fontSize: 28, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--t-text-1)', textWrap: 'balance' }}>
        {guide.title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: 'var(--t-text-2)' }}>{guide.summary}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <span style={{ ...pill, background: `${ORANGE}1a`, color: ORANGE, borderColor: 'transparent' }}>{guide.audience}</span>
        <span style={pill}>{guide.minutes} min</span>
      </div>

      {allowed ? (
        <div style={{ marginTop: 12 }}>{children}</div>
      ) : (
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--t-text-3)' }}>
          Esta guía es para una sección a la que tu usuario no tiene acceso. Si la necesitas, pídele permiso al administrador del restaurante.
        </p>
      )}

      {related.length > 0 && (
        <aside style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--t-border)' }}>
          <p style={{ margin: '0 0 8px', fontFamily: sm, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t-text-3)' }}>
            Guías relacionadas
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {related.map((g) => (
              <Link key={g.slug} href={ROUTES.dashboard.ayudaGuia(g.section, g.slug)} style={{ ...pill, textDecoration: 'none' }}>
                {g.title}
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text-3)', fontFamily: sg }}>¿Esta guía no resolvió tu problema?</p>
        <a
          href={SOPORTE_WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10, textDecoration: 'none',
            background: '#25D36614', border: '1.5px solid #25D36630',
            color: '#128C7E', fontWeight: 700, fontSize: 13,
            transition: 'background .15s', whiteSpace: 'nowrap',
          }}
          className="hover:bg-[#25D36620]"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Hablar con soporte
        </a>
      </div>
    </article>
  );
}
