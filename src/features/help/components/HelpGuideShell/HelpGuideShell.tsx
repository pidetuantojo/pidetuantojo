'use client';

import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';

import { HELP_GUIDES, HELP_SECTIONS } from '../../content/registry';
import { visibleGuides } from '../../helpers/help.helpers';
import type { HelpGuide } from '../../types/help.types';

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
      <nav aria-label="Ruta" style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={ROUTES.dashboard.ayuda} style={{ color: 'inherit' }}>Ayuda</Link>
        <span aria-hidden>›</span>
        <span>{section?.title}</span>
      </nav>

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
    </article>
  );
}
