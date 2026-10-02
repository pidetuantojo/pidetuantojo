export type DatePreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface PromotionStats {
  promotionId: string;
  name: string;
  // Pedidos en los que se aplicó
  orders: number;
  // Lo que costó: descuentos + domicilios regalados (los regalos no tienen valor en el pedido)
  cost: number;
  // Ventas (total cobrado) de esos pedidos
  revenue: number;
}

export interface AccountingStats {
  totalRevenue: number;
  orderCount: number;
  avgTicket: number;
  // Productos a precio de lista, descuentos de promociones y lo que quedó después de descontar
  grossSales: number;
  discounts: number;
  netSales: number;
  byPaymentMethod: Record<string, { total: number; count: number }>;
  byProduct: Array<{ name: string; units: number }>;
  byPromotion: PromotionStats[];
}
