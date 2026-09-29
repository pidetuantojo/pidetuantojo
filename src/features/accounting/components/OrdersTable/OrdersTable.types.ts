import type { Order, OrderStatus } from '@/types';

export interface OrdersTableProps {
  orders: Order[];
  statuses: OrderStatus[];
  // Sin permiso de exportar no se muestra el botón
  onExport?: () => void;
}
