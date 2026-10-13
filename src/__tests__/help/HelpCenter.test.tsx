import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { Permission } from '@/constants/permissions';

let granted: Permission[] = [];
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ can: (p: Permission) => granted.includes(p) }),
}));

import { HelpCenter } from '@/features/help/components/HelpCenter/HelpCenter';
import { HelpGuideShell } from '@/features/help/components/HelpGuideShell/HelpGuideShell';
import { HELP_GUIDES, findGuide } from '@/features/help';

describe('HelpCenter', () => {
  beforeEach(() => { granted = []; });

  it('oculta las guías que el usuario no tiene permiso de ver', () => {
    render(<HelpCenter />);
    expect(screen.getByText('Recorrido por el panel')).toBeInTheDocument();
    expect(screen.queryByText('Gestiona un pedido de principio a fin')).not.toBeInTheDocument();
  });

  it('muestra la guía de pedidos con permiso y enlaza a su ruta', () => {
    granted = ['orders.view'];
    render(<HelpCenter />);
    const link = screen.getByText('Gestiona un pedido de principio a fin').closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/ayuda/pedidos/gestionar-un-pedido');
  });

  it('filtra con el buscador y avisa cuando no hay resultados', () => {
    granted = ['orders.view'];
    render(<HelpCenter />);
    const input = screen.getByLabelText('Buscar en el centro de ayuda');
    fireEvent.change(input, { target: { value: 'comanda' } });
    expect(screen.getByText('Gestiona un pedido de principio a fin')).toBeInTheDocument();
    expect(screen.queryByText('Recorrido por el panel')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'xyz123' } });
    expect(screen.getByText(/No encontramos guías/)).toBeInTheDocument();
  });
});

describe('HelpGuideShell', () => {
  const guide = findGuide(HELP_GUIDES, 'pedidos', 'gestionar-un-pedido')!;

  it('muestra el contenido si el usuario tiene el permiso', () => {
    granted = ['orders.view'];
    render(<HelpGuideShell guide={guide}><p>Contenido</p></HelpGuideShell>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(guide.title);
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('oculta el contenido sin permiso', () => {
    granted = [];
    render(<HelpGuideShell guide={guide}><p>Contenido</p></HelpGuideShell>);
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene acceso/)).toBeInTheDocument();
  });
});
