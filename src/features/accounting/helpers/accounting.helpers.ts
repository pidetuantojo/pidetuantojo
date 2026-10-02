import * as XLSX from 'xlsx';

import { getOrderTotals } from '@/features/orders/helpers/totals.helpers';
import type { Order } from '@/types';
import type { AccountingStats, DateRange, PromotionStats } from '../types/accounting.types';

export function calculateStats(orders: Order[]): AccountingStats {
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const orderCount = orders.length;
  const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

  const byPaymentMethod = orders.reduce<Record<string, { total: number; count: number }>>(
    (acc, o) => {
      const prev = acc[o.paymentMethod] ?? { total: 0, count: 0 };
      acc[o.paymentMethod] = { total: prev.total + o.total, count: prev.count + 1 };
      return acc;
    },
    {}
  );

  // Los regalos de promociones no son ventas
  const productMap = orders.reduce<Record<string, number>>((acc, o) => {
    o.items.filter((item) => !item.isGift).forEach((item) => {
      acc[item.productName] = (acc[item.productName] ?? 0) + item.quantity;
    });
    return acc;
  }, {});

  const byProduct = Object.entries(productMap)
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => b.units - a.units);

  const grossSales = orders.reduce((acc, o) => acc + o.subtotal, 0);
  const discounts = orders.reduce((acc, o) => acc + getOrderTotals(o).discount, 0);

  return {
    totalRevenue, orderCount, avgTicket,
    grossSales, discounts, netSales: grossSales - discounts,
    byPaymentMethod, byProduct,
    byPromotion: promotionStats(orders),
  };
}

/** Ranking de promociones: cuántos pedidos trajo cada una y cuánto costó. */
export function promotionStats(orders: Order[]): PromotionStats[] {
  const map = new Map<string, PromotionStats>();
  for (const order of orders) {
    for (const applied of order.appliedPromotions ?? []) {
      const prev = map.get(applied.promotionId) ?? {
        promotionId: applied.promotionId,
        name: applied.type === 'loyalty' ? 'Premio de fidelidad' : applied.name,
        orders: 0, cost: 0, revenue: 0,
      };
      prev.orders += 1;
      prev.cost += applied.amount;
      prev.revenue += order.total;
      map.set(applied.promotionId, prev);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
}

export function getPresetRange(preset: 'today' | 'week' | 'month'): DateRange {
  const now = new Date();

  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (preset === 'week') {
    const day = now.getDay(); // 0 = Sunday
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const start = new Date(now.getFullYear(), now.getMonth(), diff);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function exportToExcel(orders: Order[]): void {
  const rows = orders.map((o) => ({
    Fecha: new Date(o.createdAt).toLocaleString('es-CO'),
    Pedido: o.orderNumber,
    Cliente: o.customerName,
    Teléfono: o.customerPhone,
    'Método de pago': o.paymentMethod,
    Items: o.items.length,
    Productos: o.subtotal,
    Descuentos: getOrderTotals(o).discount,
    Domicilio: o.deliveryFee ?? 0,
    Promociones: (o.appliedPromotions ?? []).map((p) => (p.type === 'loyalty' ? 'Premio de fidelidad' : p.name)).join(', '),
    Total: o.total,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, `pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
