'use client';

import Image from 'next/image';
import { Edit2, Trash2, Package, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type { ProductCardProps } from './ProductCard.types';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

export function ProductCard({
  product,
  category,
  index,
  isFirst,
  isLast,
  onEdit,
  onToggleAvailable,
  onDelete,
  onMoveUp,
  onMoveDown,
  isToggling,
  isDeleting,
  isMoving,
}: ProductCardProps) {
  const { id, name, price, image, adicionalIds, isActive, isAvailable } = product;

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 999, border: 'none',
    background: 'transparent', cursor: 'pointer', transition: 'background .12s',
  };

  return (
    <div
      style={{
        fontFamily: sg,
        display: 'flex', alignItems: 'center', gap: 14,
        background: '#fff', border: '1px solid #EFE7DF', borderRadius: 16, padding: '12px 16px',
        opacity: (!isActive || isMoving) ? 0.65 : 1,
        transition: 'box-shadow .18s, opacity .2s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px -8px rgba(27,21,18,.14)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Up/Down + position */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Tooltip content="Mover arriba" side="left">
          <button
            onClick={() => onMoveUp(index)}
            disabled={isFirst || isMoving}
            style={{
              ...iconBtn,
              color: isFirst ? '#d8ccc2' : '#9a8f86',
              cursor: isFirst ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!isFirst) (e.currentTarget as HTMLElement).style.background = '#F1EAE3'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </Tooltip>

        <span style={{ fontFamily: sm, fontSize: 11, fontWeight: 700, color: '#c9a78f', lineHeight: 1 }}>
          {index + 1}
        </span>

        <Tooltip content="Mover abajo" side="left">
          <button
            onClick={() => onMoveDown(index)}
            disabled={isLast || isMoving}
            style={{
              ...iconBtn,
              color: isLast ? '#d8ccc2' : '#9a8f86',
              cursor: isLast ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!isLast) (e.currentTarget as HTMLElement).style.background = '#F1EAE3'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {/* Imagen */}
      <div
        style={{
          position: 'relative', width: 64, height: 64, flexShrink: 0,
          borderRadius: 12, overflow: 'hidden', background: '#FFF1E4',
        }}
      >
        {image ? (
          <Image src={image} alt={name} fill className="object-cover" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <Package style={{ width: 28, height: 28, color: '#FFB02E', opacity: 0.5 }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1B1512' }}>{name}</span>

          {category && (
            <span style={{ background: 'rgba(255,106,26,.12)', color: '#FF6A1A', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 9px' }}>
              {category.name}
            </span>
          )}
          {!isActive && (
            <span style={{ background: '#EDE7E0', color: '#8a7f76', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 9px' }}>
              Inactivo
            </span>
          )}
          {!isAvailable && isActive && (
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 9px' }}>
              No disponible
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#FF6A1A' }}>{formatCurrency(price)}</span>
          {adicionalIds.length > 0 && (
            <span style={{ fontFamily: sm, fontSize: 11, color: '#b8aaa0' }}>
              {adicionalIds.length} adicional{adicionalIds.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Tooltip content={isAvailable ? 'Marcar no disponible' : 'Marcar disponible'}>
          <button
            onClick={() => onToggleAvailable(id, !isAvailable)}
            disabled={isToggling}
            style={{ ...iconBtn, opacity: isToggling ? 0.5 : 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F1EAE3'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isAvailable
              ? <Eye style={{ width: 16, height: 16, color: '#3F9E6A' }} />
              : <EyeOff style={{ width: 16, height: 16, color: '#b8aaa0' }} />
            }
          </button>
        </Tooltip>

        <Tooltip content="Editar">
          <button
            onClick={() => onEdit(product)}
            style={iconBtn}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F1EAE3'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Edit2 style={{ width: 15, height: 15, color: '#8a7f76' }} />
          </button>
        </Tooltip>

        <Tooltip content="Eliminar">
          <button
            onClick={() => onDelete(id, name)}
            disabled={isDeleting}
            style={{ ...iconBtn, opacity: isDeleting ? 0.5 : 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FDF1EF'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Trash2 style={{ width: 15, height: 15, color: '#D8412F' }} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
