import type { Order, OrderStatus } from '@/types';

export interface OrderCardProps {
  order: Order;
  status?: OrderStatus;
  // Pedido abierto en el panel lateral
  selected?: boolean;
  // Entregado / cancelado / mesa liberada (solo visible con "Ver finalizados")
  finished?: boolean;
  onOpen: (order: Order) => void;
}
