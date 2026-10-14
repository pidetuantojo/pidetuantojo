// Flujo "Gestiona un pedido de principio a fin" para el simulador de la guía de pedidos.
// Datos de ejemplo del restaurante demo: nunca se leen ni escriben en Firestore.
import { BASE_ORDER_STATUSES, type Order, type OrderStatus } from '@/types';

import type { FlowDefinition } from '../../components/FlowSimulator/flow.types';

export const DEMO_RESTAURANT = 'Antojos Demo';

const TS = '2026-01-01T00:00:00.000Z';

export const DEMO_STATUSES: OrderStatus[] = BASE_ORDER_STATUSES.map((s) => ({
  ...s, id: `st-${s.code}`, restaurantId: 'demo', createdAt: TS, updatedAt: TS,
}));

export const statusByCode = (code: string) => DEMO_STATUSES.find((s) => s.code === code)!;

const minutesAgo = (m: number, now: number) => new Date(now - m * 60_000).toISOString();

function demoOrder(over: Partial<Order> & Pick<Order, 'id' | 'orderNumber' | 'customerName' | 'subtotal'>): Order {
  return {
    restaurantId: 'demo', customerPhone: '3005550100', paymentMethod: 'Efectivo', items: [],
    total: over.subtotal + (over.deliveryFee ?? 0), statusId: 'st-received', createdAt: TS, updatedAt: TS,
    ...over,
  };
}

/** Pedidos de ejemplo del tablero. `now` fija los "hace X min". */
export function demoOrders(now: number) {
  return {
    // El pedido que se atiende en la guía
    main: demoOrder({
      id: 'demo-142', orderNumber: '#A-0142', customerName: 'Andrés Gómez', deliveryType: 'domicilio',
      customerAddress: 'Cra 45 #12-30', barrio: 'Laureles', subtotal: 35000, deliveryFee: 3500, createdAt: minutesAgo(0, now),
      items: [
        { productId: 'p1', productName: 'Mango biche grande', quantity: 1, unitPrice: 15000, subtotal: 18000, additionals: [{ name: 'Chamoy', price: 3000 }] },
        { productId: 'p2', productName: 'Salchipapa clásica', quantity: 1, unitPrice: 17000, subtotal: 17000, additionals: [], specialInstructions: 'Sin cebolla' },
      ],
    }),
    pickup: demoOrder({
      id: 'demo-139', orderNumber: '#A-0139', customerName: 'Laura Restrepo', deliveryType: 'recoger',
      subtotal: 22000, statusId: 'st-ready', isPaid: true, createdAt: minutesAgo(12, now),
    }),
    delivery: demoOrder({
      id: 'demo-140', orderNumber: '#A-0140', customerName: 'Valentina Ríos', deliveryType: 'domicilio',
      customerAddress: 'Cl 10 #43-12', barrio: 'El Poblado', subtotal: 37500, deliveryFee: 3500, statusId: 'st-preparing', createdAt: minutesAgo(8, now),
    }),
    table: demoOrder({
      id: 'demo-137', orderNumber: '#A-0137', customerName: 'Mesa de Camilo', deliveryType: 'mesa', tableName: 'Mesa 3',
      subtotal: 64000, statusId: 'st-confirmed', createdAt: minutesAgo(25, now),
    }),
  };
}

export interface OrderFlowState {
  arrived: boolean;
  toast: boolean;
  drawerOpen: boolean;
  status: string;
  printed: boolean;
  printing: boolean;
  whatsapp: boolean;
  driver: boolean;
  paid: boolean;
}

export const ORDER_FLOW: FlowDefinition<OrderFlowState> = {
  width: 720,
  height: 470,
  initialState: {
    arrived: false, toast: false, drawerOpen: false, status: 'received',
    printed: false, printing: false, whatsapp: false, driver: false, paid: false,
  },
  settle: (s) => ({ ...s, toast: false, printing: false, whatsapp: false }),
  steps: [
    {
      title: 'Llega un pedido nuevo', auto: true, target: 'toast',
      text: 'Suena una alerta y aparece la notificación naranja. El pedido entra a su columna (Domicilio) en estado Recibido.',
      act: (s) => ({ ...s, arrived: true, toast: true }),
    },
    {
      title: 'Abre el pedido', target: 'card',
      text: 'Toca la tarjeta para ver los productos, las notas del cliente y todas las acciones.',
      act: (s) => ({ ...s, drawerOpen: true, toast: false }),
    },
    {
      title: 'Confírmalo', target: 'status-confirmed',
      text: 'Toca “Confirmado” para avisarle a tu equipo que el pedido sigue adelante.',
      act: (s) => ({ ...s, status: 'confirmed' }),
    },
    {
      title: 'Imprime la comanda', target: 'print',
      text: 'Toca “Imprimir”. La comanda sale en la impresora de cocina con productos, adicionales y notas.',
      act: (s) => ({ ...s, printed: true, printing: true }),
    },
    {
      title: 'Pásalo a preparación', target: 'status-preparing',
      text: 'Cuando la cocina empiece, toca “En preparación”. El estado se ve igual en todas las pantallas.',
      act: (s) => ({ ...s, status: 'preparing' }),
    },
    {
      title: 'Avísale al cliente', target: 'whatsapp',
      text: 'Toca “WhatsApp”: se abre el chat del cliente con un mensaje que dice en qué estado va su pedido. Solo dale enviar.',
      act: (s) => ({ ...s, whatsapp: true }),
    },
    {
      title: 'Asigna el domiciliario', target: 'driver',
      text: 'Toca “Asignar domiciliario” y elige quién lo lleva. Su nombre aparece en la tarjeta del tablero.',
      act: (s) => ({ ...s, driver: true }),
    },
    {
      title: 'Registra el pago', target: 'pay',
      text: 'Cuando el cliente pague, toca “Pagar” y elige el método (efectivo, transferencia…). Queda marcado como Pagado.',
      act: (s) => ({ ...s, paid: true }),
    },
    {
      title: 'Márcalo entregado', target: 'status-delivered',
      text: 'Toca “Entregado”. El pedido se atenúa en el tablero y queda en la contabilidad del día.',
      act: (s) => ({ ...s, status: 'delivered', drawerOpen: false }),
    },
  ],
  doneTitle: '¡Listo! Pedido entregado',
  doneText: {
    demo: 'Ese es el flujo completo. Ahora prueba “Practica tú” y hazlo con tus propias manos.',
    practice: 'Lo hiciste tú mismo. Ya sabes atender un pedido de principio a fin.',
  },
};
