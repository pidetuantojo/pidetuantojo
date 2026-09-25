'use client';

import { useEffect, useState } from 'react';

import { cartItemCount, cartTotal, useCartStore } from '@/store/cart.store';
import { formatCurrency } from '@/lib/utils';
import type { Adicional, Category, DeliveryZone, Product, Restaurant } from '@/types';

import { CartDrawer } from '../CartDrawer';
import { CategoryTabs } from '../CategoryTabs';
import { MenuHeader } from '../MenuHeader';
import { MenuListLayout } from '../MenuListLayout';
import { MenuProductCard } from '../MenuProductCard';
import { ProductModal } from '../ProductModal';

function InstagramIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

interface MenuPageProps {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  adicionales: Adicional[];
  receivedStatusId: string;
  deliveryZones: DeliveryZone[];
  deliveryMode: 'manual' | 'zones';
}

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

function fmtHour(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'a.m.' : 'p.m.';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function checkRestaurantOpen(openingHours?: Restaurant['openingHours']): boolean {
  if (!openingHours) return true;
  const anyDefined = Object.values(openingHours).some((v) => v !== null && v !== undefined);
  if (!anyDefined) return true;
  const now = new Date();
  const today = openingHours[now.getDay()];
  if (!today) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const o = today.open.split(':').map(Number).reduce((h, m) => h * 60 + m);
  const c = today.close.split(':').map(Number).reduce((h, m) => h * 60 + m);
  return c <= o ? (mins >= o || mins < c) : (mins >= o && mins < c);
}

export function MenuPage({ restaurant, categories, products, adicionales, receivedStatusId, deliveryZones, deliveryMode }: MenuPageProps) {
  const initCart = useCartStore((s) => s.initCart);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const items = useCartStore((s) => s.items);
  const count = useCartStore(cartItemCount);
  const total = useCartStore(cartTotal);

  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isNavOpen, setNavOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [closedModalOpen, setClosedModalOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  const { primaryColor: pri, secondaryColor: sec, accentColor: acc, bgColor } = restaurant.theme;
  const bg = bgColor ?? '#FBF8F5';

  useEffect(() => {
    initCart(restaurant.id, restaurant.phone, restaurant.name);
  }, [restaurant.id, restaurant.phone, restaurant.name, initCart]);

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 180);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const layout = restaurant.menuLayout ?? 'cards';
  const visibleProducts = products.filter((p) => p.categoryId === activeCategoryId && p.isActive);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const isOpen = checkRestaurantOpen(restaurant.openingHours);
  const restaurantClosed = !isOpen;

  // ─── Closed modal (shared between mobile and desktop) ─────────────────────
  const closedModal = restaurantClosed && closedModalOpen && (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
      onClick={() => setClosedModalOpen(false)}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)' }} />
      <div
        style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#fff', borderRadius: 32, maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={() => setClosedModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F0EAE3', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6b6059" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <div style={{ padding: '28px 20px 24px', textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌙</div>
          <h2 style={{ fontFamily: sg, fontWeight: 800, fontSize: 22, color: sec, margin: '0 0 8px', letterSpacing: '-.02em' }}>¡Estamos cerrados!</h2>
          <p style={{ fontFamily: sg, fontSize: 14, color: '#7a6f66', margin: 0, lineHeight: 1.55 }}>Podés explorar nuestro menú,<br />pero por ahora no recibimos pedidos.</p>
        </div>
        {restaurant.openingHours && Object.values(restaurant.openingHours).some(Boolean) && (() => {
          const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const todayIdx = new Date().getDay();
          return (
            <div style={{ padding: '20px 20px 8px' }}>
              <div style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 14 }}>Horarios de atención</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const isToday = todayIdx === day;
                  const hours = restaurant.openingHours?.[day];
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 10, background: isToday ? `${pri}18` : 'transparent' }}>
                      <span style={{ fontFamily: sg, fontWeight: isToday ? 700 : 500, fontSize: 14, color: isToday ? sec : '#5a5048', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {isToday && <span style={{ width: 6, height: 6, borderRadius: '50%', background: pri, display: 'inline-block', flexShrink: 0 }} />}
                        {DAY_NAMES[day]}
                      </span>
                      <span style={{ fontFamily: sm, fontSize: 12, color: hours ? (isToday ? sec : '#3d3530') : '#c0b5ab', fontWeight: isToday ? 700 : 400 }}>
                        {hours ? `${fmtHour(hours.open)} – ${fmtHour(hours.close)}` : 'Cerrado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={{ padding: '16px 20px 32px' }}>
          <button onClick={() => setClosedModalOpen(false)} style={{ width: '100%', fontFamily: sg, fontWeight: 700, fontSize: 15, color: '#fff', background: pri, border: 'none', borderRadius: 999, padding: '15px 0', cursor: 'pointer' }}>Ver menú</button>
        </div>
      </div>
    </div>
  );

  // ─── Location block (shared) ───────────────────────────────────────────────
  const locationBlock = (restaurant.address || restaurant.mapEmbed) && (
    <div id="ubicacion" style={{ padding: '40px 0 32px', background: bg }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
        <h2 style={{ fontFamily: sg, fontWeight: 800, fontSize: 26, color: sec, margin: '0 0 8px', letterSpacing: '-.02em' }}>¿Dónde encontrarnos?</h2>
        {restaurant.city && <p style={{ fontFamily: sg, fontSize: 14, color: '#8a8177', margin: 0 }}>Pasá por la tienda o pedí a domicilio — estamos en {restaurant.city}.</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {restaurant.address && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: pri, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: pri, textTransform: 'uppercase', marginBottom: 4 }}>Dirección</div>
              <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 15, color: sec, lineHeight: 1.3 }}>{restaurant.address}</div>
              {restaurant.city && <div style={{ fontFamily: sg, fontSize: 13, color: '#8a8177', marginTop: 2 }}>{restaurant.city}</div>}
            </div>
          </div>
        )}
        {restaurant.mapUrl && (
          <a href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: sec, color: '#fff', borderRadius: 14, padding: '15px 18px', fontFamily: sg, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            Cómo llegar
          </a>
        )}
        {restaurant.mapEmbed && (() => {
          const raw = restaurant.mapEmbed;
          const srcMatch = raw.match(/src=["']([^"']+)["']/);
          const embedUrl = srcMatch ? srcMatch[1] : raw;
          if (!embedUrl.includes('maps/embed')) return null;
          return (
            <div style={{ borderRadius: 18, overflow: 'hidden', height: 240 }}>
              <iframe src={embedUrl} width="100%" height="100%" style={{ border: 0, display: 'block' }} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" title={`Ubicación ${restaurant.name}`} />
            </div>
          );
        })()}
      </div>
    </div>
  );

  // ─── Social block (shared) ─────────────────────────────────────────────────
  const socialBlock = (restaurant.instagram || restaurant.facebook) && (
    <div style={{ padding: '32px 0 16px', background: bg, textAlign: 'center' }}>
      <div style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 6 }}>📱 Redes sociales</div>
      <h3 style={{ fontFamily: sg, fontWeight: 800, fontSize: 22, color: sec, margin: '0 0 16px', letterSpacing: '-.01em' }}>Seguinos en redes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {restaurant.instagram && (
          <a href={restaurant.instagram} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: pri, color: '#fff', borderRadius: 14, padding: '15px 18px', fontFamily: sg, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            <InstagramIcon />Instagram
          </a>
        )}
        {restaurant.facebook && (
          <a href={restaurant.facebook} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: sec, color: '#fff', borderRadius: 14, padding: '15px 18px', fontFamily: sg, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            <FacebookIcon />Facebook
          </a>
        )}
      </div>
    </div>
  );

  // ─── Footer (shared) ──────────────────────────────────────────────────────
  const footerBlock = (
    <footer style={{ padding: '32px 0 40px', background: bg, textAlign: 'center', borderTop: '1px solid rgba(0,0,0,.06)' }}>
      {restaurant.logo && <img src={restaurant.logo} alt={restaurant.name} style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />}
      {restaurant.description && <p style={{ fontFamily: sg, fontSize: 13, color: '#8a8177', maxWidth: 280, margin: '0 auto 16px', lineHeight: 1.5 }}>{restaurant.description}</p>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 16 }}>
        <a href="#menu" style={{ fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#8a8177', textDecoration: 'none' }}>Menú</a>
        {restaurant.address && <a href="#ubicacion" style={{ fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#8a8177', textDecoration: 'none' }}>Ubicación</a>}
        <a href={`https://wa.me/${restaurant.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: sg, fontWeight: 600, fontSize: 13, color: pri, textDecoration: 'none' }}>WhatsApp</a>
      </div>
      <div style={{ fontFamily: sm, fontSize: 10, color: '#c4bbb4', letterSpacing: '.04em' }}>
        © {new Date().getFullYear()} {restaurant.name}{restaurant.city ? ` · ${restaurant.city}` : ''} · Powered by Antojo
      </div>
    </footer>
  );

  // ══════════════════════════════════════════════════════════
  // MOBILE
  // ══════════════════════════════════════════════════════════
  if (!isDesktop) {
    return (
      <div style={{ minHeight: '100vh', background: '#e8e3dd', fontFamily: sg }}>
        <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: bg, position: 'relative', boxShadow: '0 0 60px rgba(0,0,0,.18)' }}>

          <MenuHeader
            restaurant={restaurant}
            cartCount={count}
            onNavOpen={() => setNavOpen(true)}
            onCartOpen={() => setCartOpen(true)}
          />

          {stickyVisible && (
            <div style={{
              position: 'fixed', top: 0, zIndex: 40,
              left: 'max(0px, calc(50vw - 240px))',
              right: 'max(0px, calc(50vw - 240px))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: bg,
              borderBottom: `1px solid ${sec}18`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
              <button onClick={() => setNavOpen(true)} style={{ width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: `1px solid ${sec}22`, background: `${sec}0e`, display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={sec} strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </button>
              <button onClick={() => setCartOpen(true)} style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: `1px solid ${sec}22`, background: `${sec}0e`, display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={sec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                {count > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: pri, color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', fontFamily: sg, border: '1.5px solid #fff' }}>{count}</span>}
              </button>
            </div>
          )}

          <div id="menu" />

          {closedModal}

          {layout === 'cards' && (
            <>
              {categories.length > 0 && (
                <CategoryTabs categories={categories} activeId={activeCategoryId} primaryColor={pri} secondaryColor={sec} onSelect={setActiveCategoryId} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 16px 24px' }}>
                {visibleProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#9a8f86', fontFamily: sg }}>Sin productos en esta categoría.</div>
                ) : (
                  visibleProducts.map((product) => (
                    <MenuProductCard key={product.id} product={product} primaryColor={pri} secondaryColor={sec} accentColor={acc} categoryName={categoryMap.get(product.categoryId)?.name} restaurantClosed={restaurantClosed} onSelect={setSelectedProduct} />
                  ))
                )}
              </div>
            </>
          )}

          {layout === 'list' && (
            <MenuListLayout categories={categories} products={products} primaryColor={pri} secondaryColor={sec} restaurantClosed={restaurantClosed} onSelect={setSelectedProduct} />
          )}

          {count > 0 && !restaurantClosed && (
            <div style={{ position: 'fixed', bottom: 0, zIndex: 30, left: 'max(0px, calc(50vw - 240px))', right: 'max(0px, calc(50vw - 240px))', padding: '0 12px 12px' }}>
              <div style={{ borderRadius: 16, boxShadow: '0 12px 30px -12px rgba(0,0,0,.45)', overflow: 'hidden' }}>
                <div style={{ background: '#fff', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item) => (
                    <div key={item.cartId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🛍️</span>
                      <span style={{ flex: 1, fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#1B1512' }}>{item.productName}</span>
                      <span style={{ fontFamily: sm, fontSize: 12, color: '#9a8f86', marginRight: 6 }}>x{item.quantity}</span>
                      <span style={{ fontFamily: sg, fontWeight: 700, fontSize: 13, color: pri }}>{formatCurrency(item.subtotal)}</span>
                      <button onClick={(e) => { e.stopPropagation(); useCartStore.getState().removeItem(item.cartId); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div onClick={() => setCartOpen(true)} style={{ background: sec, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ minWidth: 26, height: 26, padding: '0 7px', borderRadius: 8, background: pri, color: '#fff', fontFamily: sg, fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center' }}>{count}</span>
                    <span style={{ fontFamily: sg, fontWeight: 600, fontSize: 15, color: '#fff' }}>Completar pedido</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: sg, fontWeight: 700, fontSize: 16, color: '#fff' }}>
                    {formatCurrency(total)}
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {count > 0 && !restaurantClosed && <div style={{ height: 120 }} />}

          <div style={{ padding: '0 16px' }}>
            {locationBlock}
            {socialBlock}
          </div>
          {footerBlock}

          {isNavOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)' }} onClick={() => setNavOpen(false)} />
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, background: bg, display: 'flex', flexDirection: 'column', boxShadow: '8px 0 32px rgba(0,0,0,.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
                  {restaurant.logo ? <img src={restaurant.logo} alt={restaurant.name} style={{ height: 44, width: 'auto', objectFit: 'contain' }} /> : <span style={{ fontFamily: sg, fontWeight: 800, fontSize: 18, color: sec }}>{restaurant.name}</span>}
                  <button onClick={() => setNavOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'rgba(0,0,0,.06)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={sec} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '0 20px' }} />
                <nav style={{ display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 4 }}>
                  {[
                    { label: 'Inicio', target: null },
                    { label: 'Menú', target: 'menu' },
                    ...(restaurant.address || restaurant.mapEmbed ? [{ label: 'Ubicación', target: 'ubicacion' }] : []),
                  ].map(({ label, target }) => (
                    <a key={label} href={target ? `#${target}` : '#'} onClick={(e) => { e.preventDefault(); setNavOpen(false); requestAnimationFrame(() => { if (target) { document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' }); } else { window.scrollTo({ top: 0, behavior: 'smooth' }); } }); }} style={{ fontFamily: sg, fontWeight: 600, fontSize: 17, color: sec, textDecoration: 'none', padding: '14px 12px', borderRadius: 12, display: 'block' }}>
                      {label}
                    </a>
                  ))}
                </nav>
                {(restaurant.instagram || restaurant.facebook) && (
                  <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '0 0 8px' }} />
                    {restaurant.instagram && <a href={restaurant.instagram} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: sg, fontWeight: 600, fontSize: 14, color: pri, textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: `${pri}14` }}><InstagramIcon />Instagram</a>}
                    {restaurant.facebook && <a href={restaurant.facebook} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: sg, fontWeight: 600, fontSize: 14, color: sec, textDecoration: 'none', padding: '10px 12px', borderRadius: 12, background: `${sec}14` }}><FacebookIcon />Facebook</a>}
                  </div>
                )}
              </div>
            </div>
          )}

          <ProductModal product={selectedProduct} adicionales={adicionales} primaryColor={pri} onClose={() => setSelectedProduct(null)} />
          <CartDrawer primaryColor={pri} secondaryColor={sec} receivedStatusId={receivedStatusId} deliveryZones={deliveryZones} deliveryMode={deliveryMode} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // DESKTOP
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: sg }}>

      {closedModal}

      {/* ── STICKY TOP NAVBAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', height: 64,
        padding: '0 48px', gap: 24,
        background: `${bg}f0`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${sec}18`,
      }}>
        {/* Nombre */}
        <div
          style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <span style={{ fontFamily: sg, fontWeight: 800, fontSize: 16, color: sec, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{restaurant.name}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: `${sec}22`, flexShrink: 0 }} />

        {/* Category pills */}
        <div style={{ flex: 1, display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
          {categories.map((cat) => {
            const active = activeCategoryId === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} style={{
                flexShrink: 0, padding: '6px 16px', borderRadius: 999, border: 'none',
                background: active ? pri : 'transparent',
                color: active ? '#fff' : `${sec}99`,
                fontFamily: sg, fontWeight: active ? 700 : 500, fontSize: 13,
                cursor: 'pointer', transition: 'all .15s',
              }}>
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Cart button */}
        <button onClick={() => setCartOpen(true)} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
          padding: count > 0 ? '8px 20px' : '9px 16px',
          borderRadius: 999,
          border: `1.5px solid ${count > 0 ? pri : `${sec}33`}`,
          background: count > 0 ? pri : 'transparent',
          cursor: 'pointer', transition: 'all .2s',
          fontFamily: sg, fontWeight: 700, fontSize: 14,
          color: count > 0 ? '#fff' : sec,
        }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
          {count > 0 ? `${count} ${count === 1 ? 'item' : 'items'} · ${formatCurrency(total)}` : 'Carrito'}
        </button>
      </div>

      {/* ── HERO BANNER ── */}
      <div style={{
        position: 'relative', height: 400, overflow: 'hidden',
        background: `linear-gradient(135deg, color-mix(in srgb, ${pri} 70%, #000 6%), ${sec})`,
      }}>
        {restaurant.bannerImage && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${restaurant.bannerImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}
        {/* Scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.78) 0%, rgba(0,0,0,.5) 40%, rgba(0,0,0,.15) 70%, transparent 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.5) 0%, transparent 55%)' }} />

        {/* Info overlay */}
        <div style={{ position: 'absolute', bottom: 52, left: 60, display: 'flex', alignItems: 'center', gap: 28 }}>
          {/* Logo */}
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#fff', padding: 5, boxShadow: '0 8px 28px rgba(0,0,0,.35)', flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid #f2ede7' }}>
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.name} style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontWeight: 700, fontSize: 42, color: pri, fontFamily: sg }}>{restaurant.name[0]?.toUpperCase()}</span>
              )}
            </div>
          </div>

          {/* Text */}
          <div>
            <h1 style={{ fontFamily: sg, fontWeight: 800, fontSize: 44, letterSpacing: '-.03em', color: '#fff', margin: 0, textShadow: '0 2px 16px rgba(0,0,0,.7), 0 1px 4px rgba(0,0,0,.5)', lineHeight: 1.1 }}>
              {restaurant.name}
            </h1>
            {(restaurant.tagline || restaurant.description) && (
              <p style={{ fontFamily: sg, fontSize: 16, color: 'rgba(255,255,255,.92)', margin: '8px 0 14px', maxWidth: 440, lineHeight: 1.45, textShadow: '0 1px 8px rgba(0,0,0,.65)' }}>
                {restaurant.tagline || restaurant.description}
              </p>
            )}
            {(() => {
              if (!restaurant.openingHours) return null;
              const anyDefined = Object.values(restaurant.openingHours).some((v) => v !== null && v !== undefined);
              if (!anyDefined) return null;
              const now = new Date();
              const todayHours = restaurant.openingHours[now.getDay()];
              const open = checkRestaurantOpen(restaurant.openingHours);
              const label = open && todayHours
                ? `Cierra ${fmtHour(todayHours.close)}`
                : todayHours && !open
                  ? `Abre hoy ${fmtHour(todayHours.open)}`
                  : 'Cerrado';
              return (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, background: open ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: open ? pri : '#ffffff99', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontFamily: sm, fontSize: 11, fontWeight: 700, color: open ? pri : '#fff' }}>
                    {open ? 'ABIERTO' : 'CERRADO'} · {label}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── BODY: SIDEBAR + PRODUCTS ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1400, margin: '0 auto', padding: '0 48px' }}>

        {/* Left sidebar — sticky category nav */}
        <div style={{
          width: 220, flexShrink: 0,
          position: 'sticky', top: 64,
          height: 'calc(100vh - 64px)', overflowY: 'auto',
          padding: '32px 16px 32px 0',
          scrollbarWidth: 'none' as const,
        }}>
          <div style={{ fontFamily: sm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: `${sec}66`, marginBottom: 14 }}>
            Categorías
          </div>
          {categories.map((cat) => {
            const active = activeCategoryId === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', borderRadius: 10, border: 'none',
                borderLeft: `3px solid ${active ? pri : 'transparent'}`,
                background: active ? `${pri}14` : 'transparent',
                fontFamily: sg, fontWeight: active ? 700 : 500, fontSize: 14,
                color: active ? pri : `${sec}bb`,
                cursor: 'pointer', transition: 'all .15s', marginBottom: 2,
              }}>
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, padding: '32px 0 80px 24px' }}>

          {layout === 'cards' && (
            visibleProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8f86', fontFamily: sg, fontSize: 15 }}>
                Sin productos en esta categoría.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                {visibleProducts.map((product) => (
                  <MenuProductCard
                    key={product.id}
                    product={product}
                    primaryColor={pri}
                    secondaryColor={sec}
                    accentColor={acc}
                    categoryName={categoryMap.get(product.categoryId)?.name}
                    restaurantClosed={restaurantClosed}
                    onSelect={setSelectedProduct}
                  />
                ))}
              </div>
            )
          )}

          {layout === 'list' && (
            <MenuListLayout
              categories={categories}
              products={products}
              primaryColor={pri}
              secondaryColor={sec}
              restaurantClosed={restaurantClosed}
              onSelect={setSelectedProduct}
            />
          )}
        </div>
      </div>

      {/* ── LOCATION + SOCIAL + FOOTER ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 48px' }}>
        {locationBlock}
        {socialBlock}
      </div>
      {footerBlock}

      <ProductModal product={selectedProduct} adicionales={adicionales} primaryColor={pri} onClose={() => setSelectedProduct(null)} />
      <CartDrawer primaryColor={pri} secondaryColor={sec} receivedStatusId={receivedStatusId} deliveryZones={deliveryZones} deliveryMode={deliveryMode} />
    </div>
  );
}
