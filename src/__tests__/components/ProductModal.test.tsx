import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ProductModal } from '@/features/menu/components/ProductModal';
import { useCartStore } from '@/store/cart.store';
import type { Product, Adicional } from '@/types';

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Hamburguesa Clásica',
  description: 'Con queso y lechuga',
  price: 15000,
  isAvailable: true,
  sortOrder: 0,
  categoryId: 'cat-1',
  adicionalIds: ['add-1', 'add-2'],
};

const mockAdicionales: Adicional[] = [
  { id: 'add-1', name: 'Extra queso', price: 2000, restaurantId: 'rest-1' },
  { id: 'add-2', name: 'Tocineta', price: 3000, restaurantId: 'rest-1' },
];

const defaultProps = {
  product: mockProduct,
  adicionales: mockAdicionales,
  primaryColor: '#FF5A00',
  onClose: vi.fn(),
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

describe('ProductModal', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('returns null when product is null', () => {
    const { container } = render(<ProductModal {...defaultProps} product={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows product name and price', () => {
    render(<ProductModal {...defaultProps} />);
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument();
    expect(screen.getByText('Con queso y lechuga')).toBeInTheDocument();
  });

  it('shows adicionales for the product', () => {
    render(<ProductModal {...defaultProps} />);
    expect(screen.getByText('Extra queso')).toBeInTheDocument();
    expect(screen.getByText('Tocineta')).toBeInTheDocument();
  });

  it('does not show adicionales that are not linked to the product', () => {
    const unlinkedAdicional: Adicional = {
      id: 'add-99',
      name: 'Papas fritas',
      price: 1000,
      restaurantId: 'rest-1',
    };
    render(
      <ProductModal {...defaultProps} adicionales={[...mockAdicionales, unlinkedAdicional]} />
    );
    // add-99 is not in product.adicionalIds, so it shouldn't appear
    expect(screen.queryByText('Papas fritas')).not.toBeInTheDocument();
  });

  it('starts with quantity 1', () => {
    render(<ProductModal {...defaultProps} />);
    // quantity display is the number between − and + in footer
    const footer = screen.getByText('Agregar al pedido').closest('div');
    expect(footer).toBeInTheDocument();
    // The quantity span shows "1"
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('increments quantity when + is clicked', () => {
    render(<ProductModal {...defaultProps} />);
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('decrements quantity but not below 1', () => {
    render(<ProductModal {...defaultProps} />);
    fireEvent.click(screen.getByText('−'));
    // Quantity should stay at 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('increments quantity and updates total price displayed', () => {
    render(<ProductModal {...defaultProps} />);
    // Initially qty=1, price=15000
    fireEvent.click(screen.getByText('+'));
    // qty=2, total = 15000 * 2 = 30000
    // formatCurrency(30000) in es-CO = "$ 30.000"
    // Find all currency displays — the "Agregar al pedido" button shows grandTotal
    const addButton = screen.getByRole('button', { name: /Agregar al pedido/i });
    expect(addButton.textContent).toContain('30.000');
  });

  it('selecting an additional updates the total', () => {
    render(<ProductModal {...defaultProps} />);
    // Click "Extra queso" to select it (adicional price = 2000)
    fireEvent.click(screen.getByText('Extra queso'));
    // Total should be 15000 + 2000 = 17000
    const addButton = screen.getByRole('button', { name: /Agregar al pedido/i });
    expect(addButton.textContent).toContain('17.000');
  });

  it('adds item to cart when clicking Agregar al pedido', () => {
    render(<ProductModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('prod-1');
    expect(items[0].unitPrice).toBe(15000);
    expect(items[0].quantity).toBe(1);
  });

  it('adds item with correct additionals to cart', () => {
    render(<ProductModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Extra queso'));
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].additionals).toEqual([{ name: 'Extra queso', price: 2000 }]);
    expect(items[0].subtotal).toBe(17000); // (15000 + 2000) * 1
  });

  it('adds item with correct quantity and subtotal', () => {
    render(<ProductModal {...defaultProps} />);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));

    const items = useCartStore.getState().items;
    expect(items[0].quantity).toBe(3);
    expect(items[0].subtotal).toBe(45000); // 15000 * 3
  });

  it('shows "Sin adicionales" option when product has adicionales', () => {
    render(<ProductModal {...defaultProps} />);
    expect(screen.getByText('Sin adicionales')).toBeInTheDocument();
  });

  it('does not show adicionales section when product has none', () => {
    render(
      <ProductModal
        {...defaultProps}
        product={{ ...mockProduct, adicionalIds: [] }}
        adicionales={[]}
      />
    );
    expect(screen.queryByText('Sin adicionales')).not.toBeInTheDocument();
    expect(screen.queryByText('Extra queso')).not.toBeInTheDocument();
  });
});
