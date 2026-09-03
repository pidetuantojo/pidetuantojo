'use client';

import { useEffect } from 'react';

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Select } from '@/components/ui/Select';
import { COLOMBIA_LOCATIONS, RESTAURANT_CATEGORIES } from '@/constants/colombia-locations';

import { useRestaurantForm } from '../../hooks/useRestaurantForm';
import { useCreateRestaurant } from '../../hooks/useRestaurantMutations';
import { useUpdateRestaurant } from '../../hooks/useRestaurantMutations';
import type { RestaurantFormProps } from './RestaurantForm.types';
import type { RestaurantFormData, DayHoursForm } from '../../types/restaurant.types';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = "var(--font-space-mono, monospace)";

const PALETTES = [
  { name: 'Mango',   pri: '#F59211', sec: '#1F5130', acc: '#FFE7C4', bg: '#FBF3E9' },
  { name: 'Fresa',   pri: '#E11D48', sec: '#4C0519', acc: '#FFE4E6', bg: '#FFF1F2' },
  { name: 'Bosque',  pri: '#2C7A52', sec: '#14331F', acc: '#DDF0E4', bg: '#F3F8F3' },
  { name: 'Océano',  pri: '#0284C7', sec: '#0C3250', acc: '#E0F2FE', bg: '#F0F8FF' },
  { name: 'Uva',     pri: '#7C3AED', sec: '#2A1747', acc: '#ECE2FB', bg: '#F6F3FC' },
  { name: 'Cacao',   pri: '#92400E', sec: '#1C0A00', acc: '#FDE68A', bg: '#FFFBEB' },
];

// 0=domingo, 1=lunes, ..., 6=sábado
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mostrar lun→dom

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtHour(t: string) {
  let [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'a.m.' : 'p.m.';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
function getStatusNow(hours: DayHoursForm[]): { open: boolean; text: string } {
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = hours[day];
  if (today?.on) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    const overnight = c <= o;
    const isOpen = overnight ? (mins >= o || mins < c) : (mins >= o && mins < c);
    if (isOpen) return { open: true, text: `Abierto ahora · cierra ${fmtHour(today.close)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (hours[d]?.on) {
      const when = i === 1 ? 'mañana' : DAY_LABELS[d].toLowerCase();
      return { open: false, text: `Cerrado ahora · abre ${when} ${fmtHour(hours[d].open)}` };
    }
  }
  return { open: false, text: 'Sin horario activo' };
}

function ColorPicker({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1.5px solid #E7DED6', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}>
      <div>
        <div style={{ fontFamily: sg, fontSize: 13, color: '#5a5048', fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: sm, fontSize: 10, color: '#9a8f86', marginTop: 2 }}>{hint}</div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: sm, fontSize: 11, color: '#9a8f86' }}>{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ width: 30, height: 30, border: 0, background: 'none', padding: 0, borderRadius: 8, cursor: 'pointer' }}
        />
      </span>
    </label>
  );
}

function PaletteSection({
  data,
  handleChange,
  isPending,
}: {
  data: RestaurantFormData;
  handleChange: <K extends keyof RestaurantFormData>(field: K, value: RestaurantFormData[K]) => void;
  isPending: boolean;
}) {
  function applyPalette(p: typeof PALETTES[0]) {
    handleChange('primaryColor', p.pri);
    handleChange('secondaryColor', p.sec);
    handleChange('accentColor', p.acc);
    handleChange('bgColor', p.bg);
  }
  const isActive = (p: typeof PALETTES[0]) =>
    p.pri === data.primaryColor && p.sec === data.secondaryColor && p.acc === data.accentColor;

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Paleta de colores del menú</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: '#9a8f86', marginBottom: 10 }}>ELEGÍ UNA PALETA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {PALETTES.map((p) => {
              const active = isActive(p);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPalette(p)}
                  disabled={isPending}
                  style={{
                    background: active ? '#FFF7F0' : '#fff',
                    border: `1.5px solid ${active ? p.pri : '#E7DED6'}`,
                    borderRadius: 12, padding: '10px 12px',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color .12s, background .12s',
                  }}
                >
                  <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: p.pri, display: 'block' }} />
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: p.sec, display: 'block' }} />
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: p.acc, display: 'block' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: sg, fontWeight: 600, fontSize: 12, color: '#1B1512' }}>{p.name}</span>
                    {active && <span style={{ fontFamily: sm, fontSize: 11, color: p.pri }}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.06em', color: '#9a8f86', marginBottom: 10 }}>O PERSONALIZÁ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ColorPicker label="Primario" hint="Botones y precios" value={data.primaryColor} onChange={(v) => handleChange('primaryColor', v)} disabled={isPending} />
            <ColorPicker label="Secundario" hint="Títulos y barra inferior" value={data.secondaryColor} onChange={(v) => handleChange('secondaryColor', v)} disabled={isPending} />
            <ColorPicker label="Acento" hint="Destacados suaves" value={data.accentColor} onChange={(v) => handleChange('accentColor', v)} disabled={isPending} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function RestaurantForm({ restaurant, onSuccess, onCancel, onColorsChange }: RestaurantFormProps) {
  const { data, errors, handleChange, setDayHours, validate, toCreateData, toUpdateData, isEditing } =
    useRestaurantForm(restaurant);

  useEffect(() => {
    onColorsChange?.({ pri: data.primaryColor, sec: data.secondaryColor, acc: data.accentColor, bg: data.bgColor, name: data.name, layout: data.menuLayout, logo: data.logo, bannerImage: data.bannerImage });
  }, [data.primaryColor, data.secondaryColor, data.accentColor, data.bgColor, data.name, data.menuLayout, data.logo, data.bannerImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useCreateRestaurant();
  const updateMutation = useUpdateRestaurant();
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (isEditing && restaurant) {
        await updateMutation.mutateAsync({ id: restaurant.id, data: toUpdateData() });
      } else {
        await createMutation.mutateAsync(toCreateData());
      }
      onSuccess();
    } catch {
      // El error se muestra desde el estado del mutation
    }
  }

  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  // Opciones para los selectores de ubicación
  const depOptions = Object.keys(COLOMBIA_LOCATIONS).sort().map((d) => ({ value: d, label: d }));
  const cityOptions = data.department
    ? (COLOMBIA_LOCATIONS[data.department] ?? []).map((c) => ({ value: c, label: c }))
    : [];

  const categoryOptions = RESTAURANT_CATEGORIES.map((c) => ({ value: c, label: c }));

  // Horario — estado y helpers
  const statusNow = getStatusNow(data.openingHours);

  function applyWeekdaysToAll() {
    const monHours = data.openingHours[1];
    const next = data.openingHours.map((_, i) =>
      i === 0
        ? { on: monHours.on, open: monHours.open, close: monHours.close } // domingo mantiene el toggle del lunes
        : { on: monHours.on, open: monHours.open, close: monHours.close }
    );
    handleChange('openingHours', next);
  }

  // Resumen para mostrar al final del horario
  const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const hoursSummary = DAY_ORDER
    .map((i) => {
      const d = data.openingHours[i];
      return d?.on ? `${DAY_SHORT[i]}  ${d.open}–${d.close}` : null;
    })
    .filter(Boolean)
    .join('\n') || 'Sin días activos';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-6 p-6">

        {/* Sección: Información básica */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Información básica
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre del restaurante"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
              placeholder="Ej: La Parrilla de Juan"
              required
              disabled={isPending}
            />
            <Input
              label="Slug (URL)"
              value={data.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              error={errors.slug}
              placeholder="la-parrilla-de-juan"
              hint="Se auto-genera desde el nombre"
              required
              disabled={isPending || isEditing}
            />
          </div>

          <Input
            label="Tagline"
            value={data.tagline}
            onChange={(e) => handleChange('tagline', e.target.value)}
            placeholder="Ej: granizados de mango artesanales"
            hint="Subtítulo que aparece en el panel del administrador"
            disabled={isPending}
          />

          <Textarea
            label="Descripción"
            value={data.description}
            onChange={(e) => handleChange('description', e.target.value)}
            error={errors.description}
            placeholder="Breve descripción del restaurante..."
            rows={3}
            required
            disabled={isPending}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Teléfono / WhatsApp"
              value={data.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={errors.phone}
              placeholder="+57 300 000 0000"
              required
              disabled={isPending}
            />
            <Select
              label="Categoría (tipo de cocina) *"
              value={data.category}
              onChange={(v) => handleChange('category', v)}
              options={categoryOptions}
              placeholder="Seleccioná una categoría..."
              error={errors.category}
              disabled={isPending}
            />
          </div>
        </section>

        {/* Sección: Branding */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Branding
          </h3>

          <ImageUpload
            label="Logo del restaurante *"
            value={data.logo}
            onChange={(url) => handleChange('logo', url)}
            disabled={isPending}
            aspectRatio="wide"
            objectFit="contain"
          />
          {errors.logo && <p className="text-xs text-red-600">{errors.logo}</p>}

          <ImageUpload
            label="Foto de portada del menú (opcional)"
            value={data.bannerImage}
            onChange={(url) => handleChange('bannerImage', url)}
            disabled={isPending}
            aspectRatio="wide"
          />
          <p className="text-xs text-gray-400">Se muestra como header del menú público. Si no subís foto, se usa el color de tu marca.</p>
        </section>

        {/* Sección: Formato del menú */}
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Formato del menú público</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              {
                id: 'cards' as const,
                name: 'Tarjetas',
                desc: 'Foto grande + botón añadir',
                thumb: (
                  <div style={{ position: 'absolute', inset: 9, background: '#fff', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ height: 34, background: '#E7DED6' }} />
                    <div style={{ height: 7, width: 52, margin: '6px 8px 0', background: '#cfc6bd', borderRadius: 3 }} />
                    <div style={{ height: 9, margin: '6px 8px', background: data.primaryColor, borderRadius: 4 }} />
                  </div>
                ),
              },
              {
                id: 'list' as const,
                name: 'Lista por categorías',
                desc: 'Acordeón compacto con +',
                thumb: (
                  <div style={{ position: 'absolute', inset: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ height: 15, background: data.secondaryColor, borderRadius: 4 }} />
                    {[0, 1].map((i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, background: '#fff', borderRadius: 5, padding: '0 6px', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, background: '#E7DED6', flexShrink: 0 }} />
                        <span style={{ flex: 1, height: 5, background: '#d8cec4', borderRadius: 3 }} />
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: data.primaryColor, flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                ),
              },
            ]).map((f) => {
              const sel = data.menuLayout === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleChange('menuLayout', f.id)}
                  disabled={isPending}
                  style={{
                    background: '#fff',
                    border: sel ? `2px solid #FF6A1A` : '1.5px solid #ece6df',
                    borderRadius: 14, padding: 14,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color .12s',
                  }}
                >
                  <div style={{ position: 'relative', height: 74, borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: sel ? '#FFF3EA' : '#F6F1EB' }}>
                    {f.thumb}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#1B1512', lineHeight: 1.2 }}>{f.name}</div>
                      <div style={{ fontFamily: sg, fontSize: 11, color: '#8a7f76', marginTop: 2 }}>{f.desc}</div>
                    </div>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, color: '#fff', background: '#FF6A1A', opacity: sel ? 1 : 0, flexShrink: 0 }}>✓</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sección: Modo de domicilios */}
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Modo de domicilios</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              {
                id: 'manual' as const,
                name: 'Manual',
                desc: 'El admin asigna el valor del domicilio desde gestión de pedidos',
                icon: (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                ),
              },
              {
                id: 'zones' as const,
                name: 'Por zonas',
                desc: 'El cliente elige su barrio/sector y el precio se aplica automáticamente',
                icon: (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                    <line x1="9" y1="3" x2="9" y2="18"/>
                    <line x1="15" y1="6" x2="15" y2="21"/>
                  </svg>
                ),
              },
            ]).map((mode) => {
              const sel = data.deliveryMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleChange('deliveryMode', mode.id)}
                  disabled={isPending}
                  style={{
                    background: '#fff',
                    border: sel ? '2px solid #FF6A1A' : '1.5px solid #ece6df',
                    borderRadius: 14, padding: 14,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color .12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 10, marginBottom: 10, background: sel ? '#FFF3EA' : '#F6F1EB', color: sel ? '#FF6A1A' : '#9a8f86' }}>
                    {mode.icon}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: sg, fontWeight: 600, fontSize: 13, color: '#1B1512', lineHeight: 1.2 }}>{mode.name}</div>
                      <div style={{ fontFamily: sg, fontSize: 11, color: '#8a7f76', marginTop: 3, lineHeight: 1.4 }}>{mode.desc}</div>
                    </div>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, color: '#fff', background: '#FF6A1A', opacity: sel ? 1 : 0, flexShrink: 0 }}>✓</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sección: Tema */}
        <PaletteSection data={data} handleChange={handleChange} isPending={isPending} />

        {/* Sección: Ubicación */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Ubicación
          </h3>
          <Input
            label="Dirección"
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Manzana D Casa 13B, Villa Universitaria"
            disabled={isPending}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Departamento *"
              value={data.department}
              onChange={(v) => handleChange('department', v)}
              options={depOptions}
              placeholder="Seleccioná un departamento..."
              hint="Define en qué departamento aparecés"
              error={errors.department}
              disabled={isPending}
            />
            <Select
              label="Ciudad *"
              value={data.city}
              onChange={(v) => handleChange('city', v)}
              options={cityOptions}
              placeholder={data.department ? 'Seleccioná una ciudad...' : 'Primero elegí el departamento'}
              hint="Se filtra según el departamento"
              error={errors.city}
              disabled={isPending || !data.department}
            />
          </div>
          {data.department && data.city && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: sm, fontSize: 11.5, color: '#8a7f76', background: '#FBF8F5', border: '1px solid #F1EAE3', borderRadius: 11, padding: '10px 13px' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              En el home aparecerás en <b style={{ color: '#5a5048', marginLeft: 4 }}>{data.city}, {data.department}</b>
            </div>
          )}
          <Input
            label="Link Google Maps"
            value={data.mapUrl}
            onChange={(e) => handleChange('mapUrl', e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            hint="Se usa en el botón 'Cómo llegar' del menú"
            disabled={isPending}
          />
          <Input
            label="URL embed del mapa"
            value={data.mapEmbed}
            onChange={(e) => {
              const val = e.target.value;
              const srcMatch = val.match(/src=["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/);
              handleChange('mapEmbed', srcMatch ? srcMatch[1] : val);
            }}
            placeholder="https://www.google.com/maps/embed?pb=..."
            hint="Google Maps → Compartir → Insertar mapa → podés pegar el iframe completo o solo la URL del src"
            disabled={isPending}
          />
        </section>

        {/* Sección: Redes sociales */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Redes sociales
          </h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Instagram"
              value={data.instagram}
              onChange={(e) => handleChange('instagram', e.target.value)}
              placeholder="https://instagram.com/tu.restaurante"
              hint="URL completa del perfil de Instagram"
              disabled={isPending}
            />
            <Input
              label="Facebook"
              value={data.facebook}
              onChange={(e) => handleChange('facebook', e.target.value)}
              placeholder="https://facebook.com/tu.restaurante"
              hint="URL completa de la página de Facebook"
              disabled={isPending}
            />
          </div>
        </section>

        {/* Sección: Horario de atención */}
        <section className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Horario de atención
            </h3>
            <span style={{
              fontFamily: sm, fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
              borderRadius: 999, padding: '5px 11px', flexShrink: 0,
              color: statusNow.open ? '#14331F' : '#5a5048',
              background: statusNow.open ? '#7BD88F' : '#EDE7E0',
            }}>
              {statusNow.text}
            </span>
          </div>
          <p style={{ fontFamily: sg, fontSize: 12.5, color: '#8a7f76', margin: 0 }}>
            Activá los días que abrís y definí la hora de apertura y cierre. El menú y el home muestran automáticamente si estás abierto o cerrado.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DAY_ORDER.map((dayIndex) => {
              const day = data.openingHours[dayIndex];
              return (
                <div
                  key={dayIndex}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: day.on ? '#fff' : '#FAFAF9',
                    border: `1.5px solid ${day.on ? '#E7DED6' : '#F1EAE3'}`,
                    borderRadius: 12, padding: '10px 14px',
                    transition: 'background .12s, border-color .12s',
                  }}
                >
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setDayHours(dayIndex, { on: !day.on })}
                    disabled={isPending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: 140, flexShrink: 0, background: 'none',
                      border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {/* Switch pill */}
                    <span style={{
                      width: 38, height: 22, borderRadius: 999, flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                      padding: 3,
                      background: day.on ? '#FF6A1A' : '#D8D0C8',
                      transition: 'background .2s',
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,.22)',
                        transform: day.on ? 'translateX(16px)' : 'translateX(0)',
                        transition: 'transform .2s',
                        display: 'block',
                      }} />
                    </span>
                    <span style={{
                      fontFamily: sg, fontWeight: 600, fontSize: 13,
                      color: day.on ? '#1B1512' : '#a89e95',
                      transition: 'color .15s',
                    }}>
                      {DAY_LABELS[dayIndex]}
                    </span>
                  </button>

                  {day.on ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <input
                        type="time"
                        value={day.open}
                        onChange={(e) => setDayHours(dayIndex, { open: e.target.value })}
                        disabled={isPending}
                        style={{
                          fontFamily: sm, fontSize: 13, color: '#1B1512',
                          border: '1.5px solid #E7DED6', background: '#fff',
                          borderRadius: 9, padding: '7px 10px', outline: 'none',
                        }}
                      />
                      <span style={{ fontFamily: sm, fontSize: 13, color: '#b3a89e' }}>–</span>
                      <input
                        type="time"
                        value={day.close}
                        onChange={(e) => setDayHours(dayIndex, { close: e.target.value })}
                        disabled={isPending}
                        style={{
                          fontFamily: sm, fontSize: 13, color: '#1B1512',
                          border: '1.5px solid #E7DED6', background: '#fff',
                          borderRadius: 9, padding: '7px 10px', outline: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontFamily: sm, fontSize: 12, color: '#b3a89e' }}>Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={applyWeekdaysToAll}
            disabled={isPending}
            style={{
              fontFamily: sg, fontWeight: 600, fontSize: 12,
              color: '#5a5048', background: '#FBF8F5',
              border: '1.5px solid #E7DED6', borderRadius: 10,
              padding: '9px 13px', cursor: 'pointer',
            }}
          >
            Copiar Lunes a toda la semana
          </button>

          <div style={{
            fontFamily: sm, fontSize: 10.5, lineHeight: 1.9, color: '#a89e95',
            background: '#FBF8F5', border: '1px solid #F1EAE3',
            borderRadius: 11, padding: '12px 14px',
            whiteSpace: 'pre-line',
          }}>
            <span style={{ color: '#6f655d', fontWeight: 700 }}>openingHours</span> (schema.org){'\n'}
            {hoursSummary}
          </div>
        </section>

        {/* Sección: Usuario administrador (solo en creación) */}
        {!isEditing && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Usuario administrador
            </h3>
            <p className="text-xs text-gray-500">
              Este usuario podrá acceder al dashboard del restaurante.
            </p>
            <Input
              label="Nombre completo"
              value={data.adminName}
              onChange={(e) => handleChange('adminName', e.target.value)}
              error={errors.adminName}
              placeholder="Juan García"
              required
              disabled={isPending}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Correo electrónico"
                type="email"
                value={data.adminEmail}
                onChange={(e) => handleChange('adminEmail', e.target.value)}
                error={errors.adminEmail}
                placeholder="admin@restaurante.com"
                required
                disabled={isPending}
              />
              <Input
                label="Contraseña"
                type="password"
                value={data.adminPassword}
                onChange={(e) => handleChange('adminPassword', e.target.value)}
                error={errors.adminPassword}
                placeholder="Mínimo 6 caracteres"
                required
                disabled={isPending}
              />
            </div>
          </section>
        )}

        {/* Estado */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={data.isActive}
            onChange={(e) => handleChange('isActive', e.target.checked)}
            className="h-4 w-4 rounded accent-orange-500"
            disabled={isPending}
          />
          <span className="text-sm font-medium text-gray-700">Restaurante activo</span>
        </label>

        {mutationError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mutationError}</p>
        )}
      </div>

      {/* Footer con botones */}
      <div className="flex flex-shrink-0 gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending} className="flex-1">
          {isEditing ? 'Guardar cambios' : 'Crear restaurante'}
        </Button>
      </div>
    </form>
  );
}
