'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';

import { HELP_GUIDES, HELP_SECTIONS } from '../../content/registry';
import { groupBySection, searchGuides, visibleGuides } from '../../helpers/help.helpers';

const SOPORTE_WA_URL = 'https://wa.me/PENDIENTE?text=Hola%2C%20necesito%20ayuda%20con%20Pide%20Tu%20Antojo';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";
const ORANGE = '#FF6A1A';
const WA_GREEN = '#25D366';

function IcoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={WA_GREEN} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function HelpCenter() {
  const { can } = useAuth();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const allowed = visibleGuides(HELP_GUIDES, can);
    return groupBySection(HELP_SECTIONS, searchGuides(allowed, query));
  }, [can, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: sg, maxWidth: 960 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>Centro de ayuda</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--t-text-3)', maxWidth: 560 }}>
          Guías paso a paso para operar tu restaurante en Pide tu Antojo.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca: imprimir, domiciliario, cobrar..."
        aria-label="Buscar en el centro de ayuda"
        style={{
          width: '100%', maxWidth: 520, padding: '12px 16px', borderRadius: 999,
          border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', color: 'var(--t-text-1)',
          fontFamily: sg, fontSize: 16, outline: 'none',
        }}
      />

      {groups.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--t-text-3)' }}>
          No encontramos guías para &quot;{query}&quot;. Probá con otra palabra.
        </p>
      )}

      <a
        href={SOPORTE_WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '11px 18px', borderRadius: 14, textDecoration: 'none',
          background: '#e8faf0', border: '1.5px solid #b2dfcc',
          color: '#0a7a4f', fontWeight: 700, fontSize: 14, width: 'fit-content',
        }}
      >
        <IcoWhatsApp />
        Hablar con soporte
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {groups.map(({ section, guides }) => (
          <section
            key={section.slug}
            style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--t-text-1)' }}>{section.title}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>{section.description}</p>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={ROUTES.dashboard.ayudaGuia(g.section, g.slug)}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', margin: '0 -10px', borderRadius: 10, textDecoration: 'none', color: 'var(--t-text-1)' }}
                    className="hover:bg-[var(--t-surface-2)]"
                  >
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{g.title}</span>
                    <span style={{ flexShrink: 0, fontFamily: sm, fontSize: 11, color: ORANGE, alignSelf: 'center' }}>{g.minutes} min</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
