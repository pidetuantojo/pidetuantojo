import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { CartDrawer } from '@/features/menu/components/CartDrawer';
import { useCartStore } from '@/store/cart.store';
import { ordersService } from '@/features/orders/services/orders.service';
import { openWhatsApp } from '@/features/menu/helpers/whatsapp.helpers';

vi.mock('@/features/orders/services/orders.service', () => ({
  ordersService: {
    create: vi.fn().mockResolvedValue('order-id-1'),
  },
}));

vi.mock('@/features/menu/helpers/whatsapp.helpers', () => ({
  buildWhatsAppMessage: vi.fn().mockReturnValue('mensaje de prueba'),
  openWhatsApp: vi.fn(),
}));

const mockItem = {
  cartId: 'cart-1',
  productId: 'prod-1',
  productName: 'Hamburguesa Clásica',
  quantity: 2,
  unitPrice: 15000,
  subtotal: 30000,
  additionals: [],
  specialInstructions: '',
};

const defaultProps = {
  primaryColor: '#FF5A00',
  secondaryColor: '#2C7A52',
  receivedStatusId: 'received',
  deliveryZones: [],
  deliveryMode: 'manual' as const,
};

function resetStore() {
  useCartStore.setState({
    restaurantId: 'rest-1',
    restaurantPhone: '573001234567',
    restaurantName: 'Mi Restaurante',
    items: [],
    isCartOpen: false,
  });
}

describe('CartDrawer', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('returns null when cart is closed', () => {
    const { container } = render(<CartDrawer {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty cart message when open with no items', () => {
    useCartStore.setState({ isCartOpen: true });
    render(<CartDrawer {...defaultProps} />);
    expect(screen.getByText('Tu pedido está vacío')).toBeInTheDocument();
    expect(screen.getByText(/Agregá productos del menú/i)).toBeInTheDocument();
  });

  it('renders cart items when cart has items', () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument();
  });

  it('shows checkout form when cart has items', () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);
    expect(screen.getByPlaceholderText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Celular/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Pedido/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting with empty form', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(screen.getByText(/Elegí cómo recibís tu pedido/i)).toBeInTheDocument();
      expect(screen.getByText(/Elegí un método de pago/i)).toBeInTheDocument();
    });
  });

  it('calls ordersService.create and openWhatsApp on valid recoger + efectivo submit', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Juan Pérez' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3001234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(ordersService.create)).toHaveBeenCalledOnce();
      expect(vi.mocked(openWhatsApp)).toHaveBeenCalledOnce();
    });
  });

  it('saves paymentMethod as "Efectivo" (capitalized) to Firestore', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Juan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3001234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(ordersService.create)).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'Efectivo' }),
      );
    });
  });

  it('saves paymentMethod as "Transferencia" (capitalized) to Firestore', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'María' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3009876543' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(ordersService.create)).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'Transferencia' }),
      );
    });
  });

  it('shows loading state while waiting for ordersService.create', async () => {
    vi.mocked(ordersService.create).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve('id'), 500)),
    );

    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Juan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3001234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(screen.getByText('Enviando...')).toBeInTheDocument();
    });
  });

  it('clears cart and closes drawer after successful submit', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'Juan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3001234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(useCartStore.getState().items).toHaveLength(0);
      expect(useCartStore.getState().isCartOpen).toBe(false);
    });
  });

  it('removes item from cart when qty decremented to 0', () => {
    useCartStore.setState({
      isCartOpen: true,
      items: [{ ...mockItem, quantity: 1, subtotal: 15000 }],
    });
    render(<CartDrawer {...defaultProps} />);

    // Button order: [0]=X close, [1]=Minus, [2]=Plus, [3]=Trash, [4]=nota, ...
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Minus button decrements qty 1→0 → removes item

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('vaciar pedido button clears cart', () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByText('Vaciar pedido'));

    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
