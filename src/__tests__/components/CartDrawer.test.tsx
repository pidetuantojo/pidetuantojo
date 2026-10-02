import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { CartDrawer } from '@/features/menu/components/CartDrawer';
import { useCartStore } from '@/store/cart.store';
import { checkoutService, CheckoutRequestError } from '@/features/menu/services/checkout.service';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/features/menu/helpers/whatsapp.helpers';
import type { CheckoutResponse } from '@/lib/orders/checkout.schema';
import type { Product, Promotion } from '@/types';

// Respuesta del servidor (POST /api/orders): precios y totales calculados allá
const serverOrder: CheckoutResponse = {
  id: 'order-id-1',
  orderNumber: '#123456',
  items: [{ productId: 'prod-1', productName: 'Hamburguesa Clásica', quantity: 2, unitPrice: 15000, subtotal: 30000, additionals: [] }],
  subtotal: 30000,
  discount: 0,
  freeDelivery: false,
  total: 30000,
  appliedPromotions: [],
  paymentLabel: 'Efectivo',
};

vi.mock('@/features/menu/services/checkout.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/menu/services/checkout.service')>();
  return {
    ...actual,
    checkoutService: {
      submitOrder: vi.fn(),
      findCoupon: vi.fn(),
      customerStatus: vi.fn().mockResolvedValue({ isNew: true, promoUses: {}, loyalty: null }),
    },
  };
});

vi.mock('@/features/menu/helpers/whatsapp.helpers', () => ({
  buildWhatsAppMessage: vi.fn().mockReturnValue('mensaje de prueba'),
  buildWhatsAppUrl: vi.fn().mockReturnValue('https://wa.me/573001234567?text=mensaje'),
}));

// El envío termina navegando a WhatsApp (window.location.href); jsdom no navega, así que se reemplaza
const originalLocation = window.location;
function mockLocation() {
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true, configurable: true });
}
function restoreLocation() {
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
}
const WHATSAPP_URL = 'https://wa.me/573001234567?text=mensaje';

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
    vi.mocked(checkoutService.submitOrder).mockResolvedValue(serverOrder);
    mockLocation();
  });

  afterEach(() => {
    restoreLocation();
  });

  it('returns null when cart is closed', () => {
    const { container } = render(<CartDrawer {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty cart message when open with no items', () => {
    useCartStore.setState({ isCartOpen: true });
    render(<CartDrawer {...defaultProps} />);
    expect(screen.getByText('Tu pedido está vacío')).toBeInTheDocument();
    expect(screen.getByText(/Agrega productos del menú/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Elige la forma de entrega/i)).toBeInTheDocument();
      expect(screen.getByText(/Elige un método de pago/i)).toBeInTheDocument();
    });
  });

  it('envía el pedido al servidor y abre WhatsApp (recoger + efectivo)', async () => {
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
      expect(vi.mocked(checkoutService.submitOrder)).toHaveBeenCalledOnce();
      expect(window.location.href).toBe(WHATSAPP_URL);
    });
    expect(vi.mocked(buildWhatsAppUrl)).toHaveBeenCalledWith('573001234567', 'mensaje de prueba');
    // El mensaje lleva el número de orden generado y el subtotal de productos
    expect(vi.mocked(buildWhatsAppMessage)).toHaveBeenCalledWith(
      'Mi Restaurante',
      expect.any(Array),
      expect.objectContaining({ orderNumber: '#123456', subtotal: 30000, deliveryType: 'recoger' }),
    );
  });

  it('manda al servidor qué se pidió (no precios): productos, entrega y método de pago', async () => {
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
      expect(vi.mocked(checkoutService.submitOrder)).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          paymentMethodId: 'efectivo',
          deliveryType: 'recoger',
          customerPhone: '3001234567',
          items: [expect.objectContaining({ productId: 'prod-1', quantity: 2, additionalIds: [], additionalNames: [] })],
        }),
      );
    });
    // Nada de precios: los calcula el servidor
    const sent = vi.mocked(checkoutService.submitOrder).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sent).not.toHaveProperty('total');
    expect(sent).not.toHaveProperty('subtotal');
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
    expect(alert).toHaveTextContent('Transfiere a Nequi: 3007581655');
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), {
      target: { value: 'María' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Celular/i), {
      target: { value: '3009876543' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(checkoutService.submitOrder)).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethodId: 'n1' }),
      );
    });
  });

  it('shows loading state while waiting for the server', async () => {
    // Promesa controlada por el test: un setTimeout real resolvía después del teardown del DOM
    // y producía "window is not defined" de forma intermitente
    let resolveCreate: (value: CheckoutResponse) => void = () => {};
    vi.mocked(checkoutService.submitOrder).mockImplementationOnce(
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
    resolveCreate({ ...serverOrder, orderNumber: '#000001' });
    await waitFor(() => {
      expect(window.location.href).toBe(WHATSAPP_URL);
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
      expect(screen.getByText(/No sabes en qué mesa estás/i)).toBeInTheDocument();
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

  describe('envío al servidor', () => {
    function fillAndSubmit() {
      fireEvent.click(screen.getByRole('button', { name: 'Recoger en Local' }));
      fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
      fireEvent.change(screen.getByPlaceholderText('Nombre completo'), { target: { value: 'Juan' } });
      fireEvent.change(screen.getByPlaceholderText(/Celular/i), { target: { value: '3001234567' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirmar Pedido/i }));
    }

    it('si el pedido tiene un problema (ej. producto agotado) avisa y NO abre WhatsApp', async () => {
      vi.mocked(checkoutService.submitOrder).mockRejectedValueOnce(
        new CheckoutRequestError('"Hamburguesa Clásica" está agotado. Quítalo de tu pedido para continuar.', 409),
      );
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} />);
      fillAndSubmit();

      expect(await screen.findByText(/está agotado/)).toBeInTheDocument();
      expect(window.location.href).toBe('');
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('sin conexión envía igual por WhatsApp, sin número de orden', async () => {
      vi.mocked(checkoutService.submitOrder).mockRejectedValueOnce(new CheckoutRequestError('No hay conexión.', 0));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} />);
      fillAndSubmit();

      await waitFor(() => expect(window.location.href).toBe(WHATSAPP_URL));
      expect(vi.mocked(buildWhatsAppMessage)).toHaveBeenCalledWith(
        'Mi Restaurante',
        expect.any(Array),
        expect.not.objectContaining({ orderNumber: expect.anything() }),
      );
    });
  });

  describe('promociones', () => {
    const product: Product = {
      id: 'prod-1', restaurantId: 'rest-1', categoryId: 'cat-1', name: 'Hamburguesa Clásica', price: 15000,
      adicionalIds: [], isActive: true, isAvailable: true, sortOrder: 1, createdAt: '', updatedAt: '',
    };
    const twentyOff: Promotion = {
      id: 'promo-1', restaurantId: 'rest-1', name: 'Hamburguesas -20%', type: 'item_discount',
      discountKind: 'percent', discountValue: 20, target: { scope: 'all' },
      showInMenu: true, isActive: true, usesCount: 0, createdAt: '', updatedAt: '',
    };

    it('muestra el precio tachado y el total con descuento', () => {
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} products={[product]} promotions={[twentyOff]} />);

      // 2 x 15.000 = 30.000 → 20% menos = 24.000
      expect(screen.getAllByText('🏷 Hamburguesas -20%').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/24\.000/).length).toBeGreaterThan(0);
    });

    it('"te faltan $X" para domicilio gratis', () => {
      const freeDelivery: Promotion = { ...twentyOff, id: 'free', name: 'Envío gratis', type: 'free_delivery', minSubtotal: 50000 };
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} products={[product]} promotions={[freeDelivery]} />);

      expect(screen.getByText(/Te faltan/)).toHaveTextContent('Te faltan $20.000 para domicilio gratis');
    });

    it('valida el cupón con el servidor y lo aplica', async () => {
      vi.mocked(checkoutService.findCoupon).mockResolvedValueOnce({
        ...twentyOff, id: 'coupon', name: 'Cupón Instagram', type: 'order_discount', discountValue: 10, stackable: true, target: undefined, couponCode: 'INSTA10',
      });
      useCartStore.setState({ isCartOpen: true, items: [mockItem] });
      render(<CartDrawer {...defaultProps} products={[product]} couponsEnabled />);

      fireEvent.click(screen.getByRole('button', { name: /Tienes un cupón/ }));
      fireEvent.change(screen.getByLabelText('Código del cupón'), { target: { value: 'insta10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

      expect(await screen.findByText(/Cupón aplicado: Cupón Instagram/)).toBeInTheDocument();
      expect(vi.mocked(checkoutService.findCoupon)).toHaveBeenCalledWith('rest-1', 'INSTA10');
    });
  });
});
