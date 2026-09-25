import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { CartDrawer } from '@/features/menu/components/CartDrawer';
import { useCartStore } from '@/store/cart.store';
import { ordersService } from '@/features/orders/services/orders.service';
import { buildWhatsAppMessage, openWhatsApp } from '@/features/menu/helpers/whatsapp.helpers';

vi.mock('@/features/orders/services/orders.service', () => ({
  ordersService: {
    create: vi.fn().mockResolvedValue({ id: 'order-id-1', orderNumber: '#123456' }),
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
      expect(screen.getByText(/Elegí la forma de entrega/i)).toBeInTheDocument();
      expect(screen.getByText(/Elegí un método de pago/i)).toBeInTheDocument();
    });
  });

  it('calls ordersService.create and openWhatsApp on valid recoger + efectivo submit', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
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
    // El mensaje lleva el número de orden generado y el subtotal de productos
    expect(vi.mocked(buildWhatsAppMessage)).toHaveBeenCalledWith(
      'Mi Restaurante',
      expect.any(Array),
      expect.objectContaining({ orderNumber: '#123456', subtotal: 30000, deliveryType: 'recoger' }),
    );
  });

  it('saves paymentMethod as "Efectivo" (capitalized) to Firestore', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
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

  it('un método sin número de cuenta no copia nada ni muestra alerta', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} paymentMethods={[{ id: 'd1', type: 'daviplata', isActive: true }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Daviplata' }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('guarda en el pedido la cuenta de transferencia elegida', async () => {
    const paymentMethods = [
      { id: 'efectivo', type: 'efectivo' as const, isActive: true },
      { id: 'n1', type: 'nequi' as const, isActive: true, account: '3007581655' },
      { id: 'b1', type: 'bancolombia' as const, isActive: false, account: '86344499677' },
    ];
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} paymentMethods={paymentMethods} />);

    // Las cuentas inactivas no se muestran
    expect(screen.queryByRole('button', { name: /Bancolombia/ })).not.toBeInTheDocument();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
    fireEvent.click(screen.getByRole('button', { name: /Nequi/ }));

    // Al elegirlo se copia el número y se muestra la alerta
    expect(writeText).toHaveBeenCalledWith('3007581655');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Número de cuenta copiado');
    expect(alert).toHaveTextContent('Transferí a Nequi: 3007581655');
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'María' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3009876543' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(ordersService.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'Nequi',
          paymentMethodType: 'nequi',
          paymentAccount: '3007581655',
        }),
      );
    });
  });

  it('shows loading state while waiting for ordersService.create', async () => {
    // Promesa controlada por el test: un setTimeout real resolvía después del teardown del DOM
    // y producía "window is not defined" de forma intermitente
    let resolveCreate: (value: { id: string; orderNumber: string }) => void = () => {};
    vi.mocked(ordersService.create).mockImplementationOnce(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );

    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
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

    // Terminar el envío dentro del test para no dejar trabajo pendiente
    resolveCreate({ id: 'id', orderNumber: '#000001' });
    await waitFor(() => {
      expect(vi.mocked(openWhatsApp)).toHaveBeenCalledOnce();
    });
  });

  it('clears cart and closes drawer after successful submit', async () => {
    useCartStore.setState({ isCartOpen: true, items: [mockItem] });
    render(<CartDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
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

  describe('Comer en el Local', () => {
    const mesa = { id: 'm1', restaurantId: 'r1', name: 'Mesa 1', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '' };
    const methods = { mesa: { isActive: true } };

    it('sin mesas configuradas muestra la opción y pide preguntar al mesero', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} deliveryMethods={methods} mesas={[]} />);
      fireEvent.click(screen.getByRole('button', { name: 'Comer en el Local' }));
      expect(screen.getByText(/no tiene mesas configuradas/i)).toBeInTheDocument();
    });

    it('con mesas configuradas indica preguntar al mesero si no sabe su mesa', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} deliveryMethods={methods} mesas={[mesa]} />);
      fireEvent.click(screen.getByRole('button', { name: 'Comer en el Local' }));
      expect(screen.getByText(/No sabés en qué mesa estás/i)).toBeInTheDocument();
    });

    it('muestra la opción y el selector de mesas si hay mesas', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} deliveryMethods={methods} mesas={[mesa]} />);
      fireEvent.click(screen.getByRole('button', { name: 'Comer en el Local' }));
      expect(screen.getByRole('button', { name: 'Mesa 1' })).toBeInTheDocument();
    });
  });

  describe('local cerrado', () => {
    // domicilio sin "Programar pedido": con el check de cerrado activo igual se ofrece programado
    const methods = {
      recoger: { isActive: true, allowScheduled: true },
      domicilio: { isActive: true, allowScheduled: false },
      mesa: { isActive: true },
    };

    it('con el check activo ofrece Recoger y Domicilio y obliga a programar', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} deliveryMethods={methods} restaurantClosed allowScheduledWhenClosed />);

      expect(screen.queryByRole('button', { name: 'Comer en el Local' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Recoger en Local' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Domicilio' }));
      const checkbox = screen.getByRole('checkbox', { name: 'Programar para más tarde' });
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });

    it('con el check apagado no ofrece formas de entrega', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} deliveryMethods={methods} restaurantClosed />);

      expect(screen.queryByRole('button', { name: 'Recoger en Local' })).not.toBeInTheDocument();
      expect(screen.getByText(/no recibimos pedidos/i)).toBeInTheDocument();
    });
  });
});
