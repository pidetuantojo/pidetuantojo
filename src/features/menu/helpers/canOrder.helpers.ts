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
}: CanOrderParams): boolean {
  return (
    items.length > 0 &&
    name.trim() !== '' &&
    phone.trim() !== '' &&
    deliveryType !== '' &&
    paymentMethod !== '' &&
    (deliveryType === 'recoger' ||
      (address.trim() !== '' &&
        (isZonesMode ? selectedZoneId !== '' : barrio.trim() !== '')))
  );
}
