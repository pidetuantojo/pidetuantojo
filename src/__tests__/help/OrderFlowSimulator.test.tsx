import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { stateAtStep } from '@/features/help/components/FlowSimulator/flow.types';
import { ORDER_FLOW } from '@/features/help/simulations/order-flow/orderFlow';
import { OrderFlowScreen } from '@/features/help/simulations/order-flow/OrderFlowScreen';
import { OrderFlowSimulator } from '@/features/help/simulations/order-flow/OrderFlowSimulator';

describe('ORDER_FLOW', () => {
  it('cada paso tiene su elemento tocable en la pantalla de ese momento', () => {
    ORDER_FLOW.steps.forEach((step, i) => {
      const { container, unmount } = render(<OrderFlowScreen state={stateAtStep(ORDER_FLOW, i)} />);
      expect(container.querySelector(`[data-flow-target="${step.target}"]`), step.title).not.toBeNull();
      unmount();
    });
  });

  it('al terminar el pedido queda entregado, pagado, impreso y con domiciliario', () => {
    const end = stateAtStep(ORDER_FLOW, ORDER_FLOW.steps.length);
    expect(end).toMatchObject({ status: 'delivered', paid: true, printed: true, driver: true, drawerOpen: false });
  });

  it('lo transitorio (notificación, comanda, WhatsApp) no se arrastra al siguiente paso', () => {
    const afterArrival = stateAtStep(ORDER_FLOW, 1);
    expect(afterArrival.arrived).toBe(true);
    expect(afterArrival.toast).toBe(false);
    expect(stateAtStep(ORDER_FLOW, 4).printing).toBe(false);
  });
});

describe('OrderFlowSimulator en modo práctica', () => {
  afterEach(() => vi.useRealTimers());

  const caption = () => screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite').textContent ?? '';

  it('avanza solo cuando se toca el elemento correcto', async () => {
    vi.useFakeTimers();
    const { container } = render(<OrderFlowSimulator />);
    fireEvent.click(screen.getByRole('button', { name: /Practica tú/ }));

    // El primer paso (llega el pedido) ocurre solo
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(caption()).toContain('Abre el pedido');

    // Tocar otra cosa no avanza
    fireEvent.click(container.querySelector('[data-flow-target="pay"]')!);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(caption()).toContain('Abre el pedido');

    fireEvent.click(container.querySelector('[data-flow-target="card"]')!);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(caption()).toContain('Confírmalo');
  });
});
