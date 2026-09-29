'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Eye, EyeOff, Package, ChevronUp, ChevronDown, ChevronsUpDown, ZoomIn, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Category, Product } from '@/types';

type SortCol = 'name' | 'price' | 'category';
type SortDir = 'asc' | 'desc';
type PageSize = 20 | 50;

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

interface Props {
  products: Product[];
  categoryMap: Map<string, Category>;
  onEdit: (p: Product) => void;
  onToggleAvailable: (id: string, val: boolean) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  togglingId: string | null;
  deletingId: string | null;
  movingId: string | null;
}

function SortIcon({ col, active, dir }: { col: SortCol; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown style={{ width: 13, height: 13, opacity: 0.35, flexShrink: 0 }} />;
  return dir === 'asc'
    ? <ChevronUp style={{ width: 13, height: 13, color: '#FF6A1A', flexShrink: 0 }} />
    : <ChevronDown style={{ width: 13, height: 13, color: '#FF6A1A', flexShrink: 0 }} />;
}

export function ProductsTable({ products, categoryMap, onEdit, onToggleAvailable, onDelete, onMoveUp, onMoveDown, togglingId, deletingId, movingId }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [hoverImg, setHoverImg] = useState<string | null>(null);

  // Reset page when products list changes (filter applied)
  useEffect(() => { setPage(1); }, [products.length]);

  // Close lightbox on ESC
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortCol(null); // tercer click: limpia el sort → vuelve al orden default
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  const sorted = [...products].sort((a, b) => {
    if (!sortCol) return 0;
    let va: string | number = 0;
    let vb: string | number = 0;
    if (sortCol === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    if (sortCol === 'price') { va = a.price; vb = b.price; }
    if (sortCol === 'category') {
      va = (categoryMap.get(a.categoryId)?.name ?? '').toLowerCase();
      vb = (categoryMap.get(b.categoryId)?.name ?? '').toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    fontFamily: sm, fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
    color: 'var(--t-text-3)', textTransform: 'uppercase',
    background: 'var(--t-surface-2)', borderBottom: '1px solid var(--t-border-2)',
    userSelect: 'none',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 14px', verticalAlign: 'middle',
    borderBottom: '1px solid var(--t-border-2)',
  };

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', transition: 'background .12s',
  };

  return (
    <div style={{ fontFamily: sg }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      {/* Table */}
      <div style={{ border: '1px solid var(--t-border-2)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 56 }}>Img</th>
                <th
                  style={{ ...thStyle, cursor: 'pointer' }}
                  onClick={() => handleSort('name')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Nombre <SortIcon col="name" active={sortCol === 'name'} dir={sortDir} />
                  </div>
                </th>
                <th
                  style={{ ...thStyle, width: 150, cursor: 'pointer' }}
                  onClick={() => handleSort('category')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Categoría <SortIcon col="category" active={sortCol === 'category'} dir={sortDir} />
                  </div>
                </th>
                <th
                  style={{ ...thStyle, width: 110, cursor: 'pointer' }}
                  onClick={() => handleSort('price')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Precio <SortIcon col="price" active={sortCol === 'price'} dir={sortDir} />
                  </div>
                </th>
                <th style={{ ...thStyle, width: 150 }}>Estado</th>
                <th style={{ ...thStyle, width: sortCol ? 110 : 150, textAlign: 'right' }}>
                  {sortCol
                    ? 'Acciones'
                    : <span title="Orden activo — los botones ↑↓ permiten mover">Acciones / Orden</span>
                  }
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((product, idx) => {
                const globalIndex = (safePage - 1) * pageSize + idx;
                const category = categoryMap.get(product.categoryId);
                const isToggling = togglingId === product.id;
                const isDeleting = deletingId === product.id;
                const isMoving = movingId === product.id;
                const rowBg = idx % 2 === 0 ? 'var(--t-surface)' : 'var(--t-surface-2)';

                return (
                  <tr
                    key={product.id}
                    style={{
                      background: rowBg,
                      opacity: (!product.isActive || isMoving) ? 0.6 : 1,
                      transition: 'opacity .15s',
                    }}
                  >
                    {/* Imagen */}
                    <td style={{ ...tdStyle, padding: '8px 12px' }}>
                      <div
                        onClick={() => product.image && setLightbox({ src: product.image, name: product.name })}
                        onMouseEnter={() => product.image && setHoverImg(product.id)}
                        onMouseLeave={() => setHoverImg(null)}
                        style={{
                          position: 'relative', width: 40, height: 40, borderRadius: 8,
                          overflow: 'hidden', background: '#FFF1E4', flexShrink: 0,
                          cursor: product.image ? 'zoom-in' : 'default',
                        }}
                      >
                        {product.image ? (
                          <>
                            <Image
                              src={product.image} alt={product.name} fill
                              style={{ objectFit: 'cover', transition: 'transform .2s', transform: hoverImg === product.id ? 'scale(1.1)' : 'scale(1)' }}
                            />
                            <div style={{
                              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                              background: hoverImg === product.id ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)',
                              transition: 'background .2s',
                            }}>
                              <ZoomIn style={{ width: 14, height: 14, color: '#fff', opacity: hoverImg === product.id ? 1 : 0, transition: 'opacity .2s' }} />
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
                            <Package style={{ width: 20, height: 20, color: '#FFB02E', opacity: 0.5 }} />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Nombre */}
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t-text-1)' }}>
                        {product.name}
                      </span>
                      {product.adicionalIds.length > 0 && (
                        <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-4)', marginLeft: 8 }}>
                          {product.adicionalIds.length} adic.
                        </span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td style={tdStyle}>
                      {category ? (
                        <span style={{
                          background: 'rgba(255,106,26,.10)', color: '#FF6A1A',
                          fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 9px',
                          whiteSpace: 'nowrap',
                        }}>
                          {category.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--t-text-4)' }}>—</span>
                      )}
                    </td>

                    {/* Precio */}
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#FF6A1A', fontFamily: sm }}>
                        {formatCurrency(product.price)}
                      </span>
                    </td>

                    {/* Estado */}
                    <td style={{ ...tdStyle }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px',
                          display: 'inline-block', width: 'fit-content',
                          background: product.isActive ? '#dcfce7' : 'var(--t-surface-2)',
                          color: product.isActive ? '#16a34a' : 'var(--t-text-3)',
                        }}>
                          {product.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        {product.isActive && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px',
                            display: 'inline-block', width: 'fit-content',
                            background: product.isAvailable ? 'transparent' : '#FEF3C7',
                            color: product.isAvailable ? 'var(--t-text-4)' : '#92400E',
                          }}>
                            {product.isAvailable ? 'Disponible' : 'No disponible'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                        {/* Botones de orden — solo visibles cuando no hay sort de columna activo */}
                        {!sortCol && (
                          <>
                            <Tooltip content="Mover arriba" side="left">
                              <button
                                onClick={() => onMoveUp(globalIndex)}
                                disabled={globalIndex === 0 || isMoving}
                                style={{ ...iconBtn, opacity: (globalIndex === 0 || isMoving) ? 0.25 : 1, cursor: (globalIndex === 0 || isMoving) ? 'not-allowed' : 'pointer' }}
                                onMouseEnter={(e) => { if (globalIndex > 0) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                {isMoving
                                  ? <Loader2 style={{ width: 14, height: 14, color: '#FF6A1A', animation: 'spin 0.7s linear infinite' }} />
                                  : <ArrowUp style={{ width: 14, height: 14, color: 'var(--t-text-3)' }} />
                                }
                              </button>
                            </Tooltip>
                            <Tooltip content="Mover abajo" side="left">
                              <button
                                onClick={() => onMoveDown(globalIndex)}
                                disabled={globalIndex === products.length - 1 || isMoving}
                                style={{ ...iconBtn, opacity: (globalIndex === products.length - 1 || isMoving) ? 0.25 : 1, cursor: (globalIndex === products.length - 1 || isMoving) ? 'not-allowed' : 'pointer' }}
                                onMouseEnter={(e) => { if (globalIndex < products.length - 1) (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                {isMoving
                                  ? <Loader2 style={{ width: 14, height: 14, color: '#FF6A1A', animation: 'spin 0.7s linear infinite' }} />
                                  : <ArrowDown style={{ width: 14, height: 14, color: 'var(--t-text-3)' }} />
                                }
                              </button>
                            </Tooltip>
                            <div style={{ width: 1, height: 18, background: 'var(--t-border-2)', margin: '0 2px' }} />
                          </>
                        )}
                        <Tooltip content={product.isAvailable ? 'Marcar no disponible' : 'Marcar disponible'}>
                          <button
                            onClick={() => onToggleAvailable(product.id, !product.isAvailable)}
                            disabled={isToggling}
                            style={{ ...iconBtn, opacity: isToggling ? 0.6 : 1 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {isToggling
                              ? <Loader2 style={{ width: 15, height: 15, color: '#FF6A1A', animation: 'spin 0.7s linear infinite' }} />
                              : product.isAvailable
                                ? <Eye style={{ width: 15, height: 15, color: '#3F9E6A' }} />
                                : <EyeOff style={{ width: 15, height: 15, color: 'var(--t-text-4)' }} />
                            }
                          </button>
                        </Tooltip>
                        <Tooltip content="Editar">
                          <button
                            onClick={() => onEdit(product)}
                            style={iconBtn}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--t-surface-2)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <Edit2 style={{ width: 14, height: 14, color: 'var(--t-text-3)' }} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Eliminar">
                          <button
                            onClick={() => onDelete(product.id, product.name)}
                            disabled={isDeleting}
                            style={{ ...iconBtn, opacity: isDeleting ? 0.6 : 1 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FDF1EF'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {isDeleting
                              ? <Loader2 style={{ width: 14, height: 14, color: '#D8412F', animation: 'spin 0.7s linear infinite' }} />
                              : <Trash2 style={{ width: 14, height: 14, color: '#D8412F' }} />
                            }
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: 12, padding: '12px 16px',
          borderTop: '1px solid var(--t-border-2)', background: 'var(--t-surface-2)',
        }}>
          {/* Info + page size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)' }}>
              {sorted.length === 0 ? '0 productos' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} de ${sorted.length}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-4)' }}>Por página:</span>
              {([20, 50] as PageSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1); }}
                  style={{
                    fontFamily: sm, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: 'none',
                    cursor: 'pointer',
                    background: pageSize === size ? '#FF6A1A' : 'var(--t-surface)',
                    color: pageSize === size ? '#fff' : 'var(--t-text-3)',
                    transition: 'background .15s',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{
                ...iconBtn, width: 28, height: 28,
                color: safePage === 1 ? 'var(--t-text-4)' : 'var(--t-text-2)',
                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                opacity: safePage === 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-4)', padding: '0 2px' }}>…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    style={{
                      minWidth: 28, height: 28, borderRadius: 7, border: 'none',
                      fontFamily: sm, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: safePage === item ? '#FF6A1A' : 'transparent',
                      color: safePage === item ? '#fff' : 'var(--t-text-2)',
                      transition: 'background .15s',
                    }}
                  >
                    {item}
                  </button>
                )
              )
            }

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{
                ...iconBtn, width: 28, height: 28,
                color: safePage === totalPages ? 'var(--t-text-4)' : 'var(--t-text-2)',
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage === totalPages ? 0.4 : 1,
              }}
            >
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh', width: '100%', height: '100%' }}>
            <Image src={lightbox.src} alt={lightbox.name} fill style={{ objectFit: 'contain', borderRadius: 12 }} sizes="90vw" />
          </div>
          <p style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: sg, textAlign: 'center' }}>
            {lightbox.name}
          </p>
        </div>
      )}
    </div>
  );
}
