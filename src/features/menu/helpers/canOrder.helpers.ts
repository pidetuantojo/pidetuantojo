import type { CartItem } from '@/store/cart.store';
import type { DeliveryType, PaymentMethod } from './whatsapp.helpers';

interface CanOrderParams {
  items: CartItem[];
  name: string;
  phone: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  address: string;
  isZonesMode: boolean;
  selectedZoneId: string;
  barrio: string;
  selectedMesaId?: string;
  // false si el restaurante no tiene mesas configuradas: el cliente puede pedir sin elegir mesa
  mesaRequired?: boolean;
  // true = el cliente activó "programar" y la fecha/hora es válida (o no programó)
  scheduleValid?: boolean;
}

export function checkCanOrder({
  items,
  name,
  phone,
  deliveryType,
  paymentMethod,
  address,
  isZonesMode,
  selectedZoneId,
  barrio,
  selectedMesaId = '',
  mesaRequired = true,
  scheduleValid = true,
}: CanOrderParams): boolean {
  const deliveryValid =
    deliveryType === 'recoger' ||
    (deliveryType === 'mesa' && (!mesaRequired || selectedMesaId !== '')) ||
    (deliveryType === 'domicilio' &&
      address.trim() !== '' &&
      (isZonesMode ? selectedZoneId !== '' : barrio.trim() !== ''));

  return (
    items.length > 0 &&
    name.trim() !== '' &&
    phone.trim() !== '' &&
    deliveryType !== '' &&
    paymentMethod !== '' &&
    deliveryValid &&
    scheduleValid
  );
}
