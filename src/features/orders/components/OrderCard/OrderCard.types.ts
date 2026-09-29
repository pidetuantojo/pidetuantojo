import type { Domiciliario, Order, OrderStatus } from '@/types';

export interface OrderCardProps {
  order: Order;
  status?: OrderStatus;
  statuses: OrderStatus[];
  restaurantId: string;
  domiciliarios: Domiciliario[];
  onOpen: (order: Order) => void;
  onAdvance?: (orderId: string, nextStatusId: string) => void;
  onEdit?: (order: Order) => void;
  onDelete?: (order: Order) => void;
  canDelete?: boolean;
}
