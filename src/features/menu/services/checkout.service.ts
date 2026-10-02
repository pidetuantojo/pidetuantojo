// Checkout del menú público: el carrito manda QUÉ pidió y el servidor calcula precios y promociones.
import type { CheckoutInput, CheckoutResponse, CustomerStatusResponse } from '@/lib/orders/checkout.schema';
import type { Promotion } from '@/types';

/** Error con el mensaje que devolvió el servidor. `status` 0 = sin conexión. */
export class CheckoutRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CheckoutRequestError';
  }
  /** Error del pedido (producto agotado, cupón vencido…): se le muestra al cliente y no se envía. */
  get isBusinessError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CheckoutRequestError('No hay conexión. Intenta de nuevo.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CheckoutRequestError((data as { error?: string }).error ?? 'No pudimos procesar tu pedido.', response.status);
  }
  return data as T;
}

export const checkoutService = {
  submitOrder(input: CheckoutInput): Promise<CheckoutResponse> {
    return postJson<CheckoutResponse>('/api/orders', input);
  },

  async findCoupon(restaurantId: string, code: string): Promise<Promotion> {
    const { promotion } = await postJson<{ promotion: Promotion }>('/api/promotions/coupon', { restaurantId, code });
    return promotion;
  },

  customerStatus(restaurantId: string, phone: string): Promise<CustomerStatusResponse> {
    return postJson<CustomerStatusResponse>('/api/customers/status', { restaurantId, phone });
  },
};
