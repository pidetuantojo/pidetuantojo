import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ClosedScheduleBanner } from '@/features/menu/components/ClosedScheduleBanner';

describe('ClosedScheduleBanner', () => {
  it('muestra el aviso con los textos destacados en negrita', () => {
    render(<ClosedScheduleBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Estamos cerrados en este momento. Puedes programar tu pedido para cuando abramos: agrega productos al carrito y, en el pago, selecciona “Programar para más tarde”.'
    );
    expect(screen.getByText('programar tu pedido').tagName).toBe('STRONG');
    expect(screen.getByText('“Programar para más tarde”').tagName).toBe('STRONG');
  });
});
