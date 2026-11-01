'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

const TABS = [
  { href: ROUTES.dashboard.libros.root, label: 'Libro diario' },
  { href: ROUTES.dashboard.libros.mayor, label: 'Libro mayor' },
  { href: ROUTES.dashboard.libros.balance, label: 'Balance de comprobación' },
  { href: ROUTES.dashboard.libros.planDeCuentas, label: 'Plan de cuentas' },
  { href: ROUTES.dashboard.libros.reglas, label: 'Reglas contables' },
];

/** Pestañas de navegación entre las pantallas del libro contable. */
export function LedgerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Libros contables" className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              active
                ? 'bg-[#FF6A1A] text-white'
                : 'text-[var(--t-text-2)] hover:bg-[var(--t-surface-2,rgba(0,0,0,0.05))]'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
