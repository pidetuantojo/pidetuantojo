'use client';

const sg = "var(--font-sans, sans-serif)";
const sm = "var(--font-mono, monospace)";

interface MenuPreviewProps {
  pri: string;
  sec: string;
  acc: string;
  bg: string;
  name: string;
  layout?: 'cards' | 'list';
  logo?: string;
  bannerImage?: string;
}

function CardsPreview({ pri, sec, acc }: { pri: string; sec: string; acc: string }) {
  return (
    <>
      {/* category chips */}
      <div style={{ display: 'flex', gap: 7, padding: '14px 12px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 12, color: '#fff', background: pri, borderRadius: 999, padding: '7px 14px' }}>Granizados</span>
        <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 12, color: sec, background: '#fff', border: '1.5px solid #ece6df', borderRadius: 999, padding: '7px 14px' }}>Combos</span>
        <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 12, color: sec, background: '#fff', border: '1.5px solid #ece6df', borderRadius: 999, padding: '7px 14px' }}>Bebidas</span>
      </div>

      {/* product card */}
      <div style={{ margin: '10px 12px 16px', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px -14px rgba(0,0,0,.28)' }}>
        <div style={{ position: 'relative', height: 130, background: '#f5f0eb', display: 'grid', placeItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#d0c8be" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <span style={{ position: 'absolute', top: 10, left: 10, fontWeight: 600, fontSize: 11, color: '#fff', background: pri, borderRadius: 999, padding: '4px 10px', boxShadow: '0 3px 8px rgba(0,0,0,.18)' }}>Granizados</span>
          <span style={{ position: 'absolute', top: 10, right: 10, fontWeight: 700, fontSize: 12, color: pri, background: '#fff', borderRadius: 999, padding: '4px 10px', boxShadow: '0 3px 8px rgba(0,0,0,.12)' }}>$27.000</span>
        </div>
        <div style={{ padding: '12px 14px 14px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: sm, fontSize: 9, fontWeight: 700, color: pri, background: acc, borderRadius: 999, padding: '4px 8px', marginBottom: 8 }}>★ EDICIÓN ESPECIAL</span>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', color: sec, marginBottom: 4 }}>Combo Mundialista</div>
          <div style={{ fontSize: 12, color: '#8a8177', marginBottom: 12, lineHeight: 1.4 }}>Granizado de mango + topping de la casa.</div>
          <div style={{ background: pri, color: '#fff', borderRadius: 999, padding: '10px 0', textAlign: 'center', fontWeight: 700, fontSize: 13, boxShadow: `0 8px 16px -8px ${pri}` }}>
            + Añadir al pedido
          </div>
        </div>
      </div>
    </>
  );
}

function ListPreview({ pri, sec }: { pri: string; sec: string }) {
  const categories = [
    { name: 'Granizados', open: true, products: [
      { name: 'Combo Mundialista', desc: 'Granizado de mango + topping.', price: '$27.000' },
      { name: 'Maracumango', desc: 'Granizado de maracuyá y mango.', price: '$15.000' },
    ]},
    { name: 'Mangos', open: false, products: [] },
    { name: 'Bebidas', open: false, products: [] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 12px 16px' }}>
      {categories.map((cat) => (
        <div key={cat.name} style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 14px -10px rgba(0,0,0,.25)' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', background: sec }}>
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff' }}>{cat.name}</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: cat.open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
          {/* products */}
          {cat.open && (
            <div style={{ background: '#efeae4', padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {cat.products.map((p) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', borderRadius: 11, padding: '8px 10px', boxShadow: '0 2px 8px -5px rgba(0,0,0,.2)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 9, background: '#f5f0eb', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d0c8be" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: sec, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 9.5, color: '#9a9088', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</div>
                    <div style={{ fontWeight: 700, fontSize: 11, color: sec, marginTop: 2 }}>{p.price}</div>
                  </div>
                  <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 999, background: pri, display: 'grid', placeItems: 'center', boxShadow: `0 4px 10px -5px ${pri}` }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function MenuPreview({ pri, sec, acc, bg, name, layout = 'cards', logo, bannerImage }: MenuPreviewProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: bg, fontFamily: sg, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative' }}>

      {/* Cover + floating bar + hero card */}
      <div style={{ position: 'relative' }}>

        {/* Cover */}
        <div style={{
          position: 'relative', height: 160, overflow: 'hidden',
          background: `linear-gradient(135deg, color-mix(in srgb, ${pri} 70%, #000 6%), ${sec})`,
        }}>
          {bannerImage && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url('${bannerImage}')`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
          )}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 60%, color-mix(in srgb, ${bg} 92%, transparent) 100%)`,
          }} />
        </div>

        {/* Floating buttons */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </div>
          <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 999, background: pri, color: '#fff', fontSize: 7, fontWeight: 700, display: 'grid', placeItems: 'center', border: '1px solid #fff' }}>1</span>
          </div>
        </div>

        {/* Hero card */}
        <div style={{ position: 'relative', zIndex: 5, margin: '-44px 10px 0', background: '#fff', borderRadius: 18, padding: '0 16px 16px', boxShadow: '0 14px 30px -16px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ marginTop: -37, width: 74, height: 74, borderRadius: '50%', background: '#fff', padding: 4, boxShadow: '0 8px 20px -8px rgba(0,0,0,.28)', flexShrink: 0, position: 'relative', zIndex: 10 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid #f2ede7' }}>
                {logo ? (
                  <img src={logo} alt={name} style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontWeight: 700, fontSize: 22, color: pri, fontFamily: sg }}>{name?.[0]?.toUpperCase() ?? 'R'}</span>
                )}
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-.01em', color: sec, margin: '9px 0 0' }}>{name || 'Tu restaurante'}</div>
            <div style={{ fontSize: 11, color: '#7a7269', margin: '4px 0 0' }}>Granizados · especialidades</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontFamily: sm, fontSize: 8, fontWeight: 700, color: pri, background: acc, borderRadius: 999, padding: '5px 10px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: pri, display: 'inline-block' }} />
              ABIERTO · 20 min
            </div>
          </div>
        </div>
      </div>

      {/* layout content */}
      {layout === 'cards'
        ? <CardsPreview pri={pri} sec={sec} acc={acc} />
        : <ListPreview pri={pri} sec={sec} />
      }

      {/* bottom bar */}
      <div style={{ margin: '0 10px 10px', background: sec, borderRadius: 13, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 10px 24px -10px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 7, background: pri, color: '#fff', fontWeight: 700, fontSize: 11, display: 'grid', placeItems: 'center' }}>1</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>Completar pedido</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>$27.000</span>
      </div>
    </div>
  );
}
