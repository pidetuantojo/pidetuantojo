'use client';

import { useState } from 'react';
import { X, Phone, MapPin, MessageSquare, Package } from 'lucide-react';

import { formatCurrency, formatDate } from '@/lib/utils';

import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import type { OrderDetailModalProps } from './OrderDetailModal.types';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

const DELIVERY_EMOJI: Record<string, string> = {
  recoger: '🏪',
  domicilio: '🛵',
};

const PAYMENT_EMOJI: Record<string, string> = {
  Efectivo: '💵',
  Transferencia: '🏧',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      color: '#FF6A1A', textTransform: 'uppercase' as const, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

export function OrderDetailModal({
  order,
  statuses,
  products,
  restaurantId,
  isOpen,
  onClose,
}: OrderDetailModalProps) {
  const { updateStatus, isPending, error } = useUpdateOrderStatus(restaurantId);
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');

  const activeStatuses = statuses.filter((s) => s.isActive);
  const currentStatus = statuses.find((s) => s.id === order?.statusId);

  async function handleStatusUpdate(statusId: string) {
    if (!order || statusId === order.statusId) return;
    setSelectedStatusId(statusId);
    await updateStatus(order.id, statusId);
  }

  function handleWhatsApp() {
    if (!order) return;
    const status = statuses.find((s) => s.id === (selectedStatusId || order.statusId));
    const msg = encodeURIComponent(
      `Hola ${order.customerName}! Tu pedido ${order.orderNumber} está ahora en estado: *${status?.name}* 🍽️`
    );
    window.open(`https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  if (!isOpen || !order) return null;

  const normalizedPayment = order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1).toLowerCase();
  const paymentEmoji = PAYMENT_EMOJI[normalizedPayment] ?? '💰';
  const deliveryEmoji = order.deliveryType ? (DELIVERY_EMOJI[order.deliveryType] ?? '📦') : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(27,21,18,.45)', backdropFilter: 'blur(4px)',
        fontFamily: sg,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 24, width: '100%', maxWidth: 560,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 64px -20px rgba(0,0,0,.35)',
          margin: '0 16px', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid #F0EBE6',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: '#FFF3E8',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Package size={18} color="#FF6A1A" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1B1512', letterSpacing: '-.01em' }}>
                Pedido {order.orderNumber}
              </div>
              <div style={{ fontFamily: sm, fontSize: 11, color: '#9a8f86', marginTop: 1 }}>
                {formatDate(order.createdAt)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, border: '1.5px solid #E7DED6',
              background: '#fff', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: '#9a8f86', flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Current status badge */}
          {currentStatus && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9a8f86' }}>Estado actual:</span>
                <span style={{
                  borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                  color: '#fff', background: currentStatus.color,
                }}>
                  {currentStatus.name}
                </span>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Cliente</SectionLabel>
            <div style={{
              background: '#FBF8F5', borderRadius: 14, padding: '14px 16px',
              border: '1px solid #EFE7DF', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1B1512' }}>
                {order.customerName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#5a5048' }}>
                <Phone size={13} color="#9a8f86" />
                {order.customerPhone}
              </div>
              {order.customerAddress && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13, color: '#5a5048' }}>
                  <MapPin size={13} color="#9a8f86" style={{ flexShrink: 0, marginTop: 1 }} />
                  {order.customerAddress}
                  {order.barrio && <span style={{ color: '#9a8f86' }}>— {order.barrio}</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {deliveryEmoji && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#fff', border: '1.5px solid #E7DED6', borderRadius: 999,
                    padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#1B1512',
                  }}>
                    {deliveryEmoji} {order.deliveryType === 'domicilio' ? 'Domicilio' : 'Recoger en tienda'}
                  </span>
                )}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#fff', border: '1.5px solid #E7DED6', borderRadius: 999,
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#1B1512',
                }}>
                  {paymentEmoji} {order.paymentMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Ítems del pedido</SectionLabel>
            <div style={{ border: '1px solid #EFE7DF', borderRadius: 14, overflow: 'hidden' }}>
              {order.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < order.items.length - 1 ? '1px solid #F0EBE6' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Thumbnail */}
                    {(() => {
                      const img = item.productImage ?? products.find((p) => p.id === item.productId)?.image;
                      return (
                        <div style={{
                          width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                          background: '#fff', border: '1px solid #e5e7eb',
                          display: 'grid', placeItems: 'center',
                        }}>
                          {img ? (
                            <img src={img} alt={item.productName} width={44} height={44} style={{ objectFit: 'contain' }} />
                          ) : (
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#C8BFBB" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                            </svg>
                          )}
                        </div>
                      );
                    })()}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1B1512' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 20, height: 20, borderRadius: 6, background: '#FF6A1A',
                            color: '#fff', fontSize: 11, fontWeight: 700, marginRight: 7, flexShrink: 0,
                          }}>
                            {item.quantity}
                          </span>
                          {item.productName}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1B1512', flexShrink: 0 }}>
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>
                      {item.additionals.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#9a8f86', paddingLeft: 27 }}>
                          + {item.additionals.map((a) => a.name).join(', ')}
                        </div>
                      )}
                      {item.specialInstructions && (
                        <div style={{ marginTop: 3, fontSize: 12, color: '#9a8f86', fontStyle: 'italic', paddingLeft: 27 }}>
                          &ldquo;{item.specialInstructions}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#FBF8F5',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1B1512' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: '#FF6A1A' }}>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {order.notes && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Notas</SectionLabel>
              <div style={{
                display: 'flex', gap: 8, background: '#FBF8F5', borderRadius: 12,
                padding: '12px 14px', border: '1px solid #EFE7DF', fontSize: 13, color: '#5a5048',
              }}>
                <MessageSquare size={14} color="#9a8f86" style={{ flexShrink: 0, marginTop: 1 }} />
                {order.notes}
              </div>
            </div>
          )}

          {/* Cambiar estado */}
          <div style={{ marginBottom: 4 }}>
            <SectionLabel>Cambiar estado</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
              {activeStatuses.map((s) => {
                const isCurrent = s.id === order.statusId;
                const isSelected = s.id === selectedStatusId;
                return (
                  <button
                    key={s.id}
                    disabled={isPending || isCurrent}
                    onClick={() => handleStatusUpdate(s.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                      cursor: isCurrent ? 'default' : 'pointer',
                      border: isCurrent
                        ? `2px solid ${s.color}`
                        : isSelected
                          ? `2px solid #FF6A1A`
                          : '1.5px solid #E7DED6',
                      background: isCurrent ? s.color : isSelected ? '#FF6A1A' : '#fff',
                      color: isCurrent || isSelected ? '#fff' : '#5a5048',
                      opacity: isPending && !isSelected ? 0.5 : 1,
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: isCurrent || isSelected ? '#fff' : s.color,
                      flexShrink: 0,
                    }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
            {error && (
              <p style={{ fontSize: 12, color: '#e53e3e', marginTop: 8 }}>{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #F0EBE6', flexShrink: 0,
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={handleWhatsApp}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 14, border: '1.5px solid #25D366',
              background: '#f0faf4', color: '#1a7a3e', fontFamily: sg,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background .12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#dcf5e7'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0faf4'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Notificar por WhatsApp
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px', borderRadius: 14, border: '1.5px solid #E7DED6',
              background: '#fff', color: '#5a5048', fontFamily: sg,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FBF8F5'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
