'use client';

import { useState } from 'react';

import { DeliveryZonesManager } from '../DeliveryZonesManager';
import { DomiciliariosManager } from '../DomiciliariosManager';

const sg = "var(--font-sans, sans-serif)";

type Tab = 'zonas' | 'domiciliarios';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'zonas',
    label: 'Zonas de domicilio',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    key: 'domiciliarios',
    label: 'Domiciliarios',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

export function DomiciliosTabs() {
  const [active, setActive] = useState<Tab>('zonas');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: sg }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--t-surface-2)', borderRadius: 14, padding: 4, alignSelf: 'flex-start' }}>
        {TABS.map((tab) => {
          const sel = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 999, border: 'none',
                background: sel ? 'var(--t-surface)' : 'transparent',
                boxShadow: sel ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                color: sel ? 'var(--t-text-1)' : 'var(--t-text-3)',
                fontFamily: sg, fontWeight: sel ? 700 : 500, fontSize: 14,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <span style={{ color: sel ? '#FF6A1A' : 'var(--t-text-3)' }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {active === 'zonas' ? <DeliveryZonesManager /> : <DomiciliariosManager />}
    </div>
  );
}
