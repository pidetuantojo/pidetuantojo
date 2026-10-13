'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth';

import { HELP_GUIDES, HELP_SECTIONS } from '../../content/registry';
import { groupBySection, searchGuides, visibleGuides } from '../../helpers/help.helpers';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";
const ORANGE = '#FF6A1A';

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
        placeholder="Busca: imprimir, domiciliario, cobrar…"
        aria-label="Buscar en el centro de ayuda"
        style={{
          width: '100%', maxWidth: 520, padding: '12px 16px', borderRadius: 999,
          border: '1.5px solid var(--t-input-border)', background: 'var(--t-input-bg)', color: 'var(--t-text-1)',
          fontFamily: sg, fontSize: 16, outline: 'none',
        }}
      />

      {groups.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--t-text-3)' }}>
          No encontramos guías para “{query}”. Prueba con otra palabra.
        </p>
      )}

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
