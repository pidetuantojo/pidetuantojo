import type { AssignedDriver, Domiciliario, Order } from '@/types';
import { isTransferMethod } from '@/features/payment-methods/helpers/payment-methods.helpers';

/** Error de validación del campo "Domiciliario" al asignar una empresa, o null si es válido. */
export function validateCourierName(driver: Pick<Domiciliario, 'isCompany'>, courierName: string): string | null {
  if (!driver.isCompany) return null;
  return courierName.trim() ? null : 'Escribí el nombre o código del domiciliario de la empresa';
}

/** Copia del domiciliario para guardar en el pedido (sin `undefined`: Firestore los rechaza). */
export function toAssignedDriver(driver: Domiciliario, courierName = ''): AssignedDriver {
  const courier = courierName.trim();
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    ...(driver.code && !driver.isCompany ? { code: driver.code } : {}),
    ...(driver.isCompany ? { isCompany: true } : {}),
    ...(driver.isCompany && courier ? { courierName: courier } : {}),
  };
}

interface DriverMessageOptions {
  isPaid: boolean;
  grandTotal: number;
  note?: string;
}

/** Mensaje de WhatsApp para el domiciliario (o la empresa, incluyendo quién tomó el pedido). */
export function buildDriverMessage(order: Order, { isPaid, grandTotal, note }: DriverMessageOptions): string {
  const isTransfer = order.paymentMethodType ? isTransferMethod(order.paymentMethodType) : false;
  const amount = `$${grandTotal.toLocaleString('es-CO')}`;
  const payLine = isTransfer
    ? isPaid
      ? `\n*Pago:* ${order.paymentMethod} ✅`
      : `\n*Pago:* ${order.paymentMethod}\n*Cobrar:* ${amount}`
    : `\n*Cobrar:* ${amount}`;
  const address = [order.customerAddress, order.barrio].filter(Boolean).join(' — ');
  const driver = order.assignedDriver;
  const courierLine = driver?.isCompany && driver.courierName ? `*Domiciliario:* ${driver.courierName}\n` : '';
  const noteStr = note?.trim() ? `\n\n*Nota:* ${note.trim()}` : '';

  return (
    // Sin emojis fuera del plano básico (🛵, 📝): llegan como "�" por el link wa.me
    `*PEDIDO ${order.orderNumber}*\n\n` +
    courierLine +
    `*Nombre:* ${order.customerName}\n` +
    `*Dirección:* ${address}\n` +
    `*Celular:* ${order.customerPhone}` +
    payLine + noteStr
  );
}
