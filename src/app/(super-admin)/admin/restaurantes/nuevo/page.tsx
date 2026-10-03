'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { RestaurantForm } from '@/features/restaurants/components/RestaurantForm';

const sg = "var(--font-sans, sans-serif)";
const sm = 'var(--font-mono, monospace)';

export default function NuevoRestaurantePage() {
  const router = useRouter();

  function goBack() {
    router.push('/admin/restaurantes');
  }

  return (
    <div style={{ fontFamily: sg, maxWidth: 640, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 11, border: '1.5px solid #E7DED6',
            background: '#fff', color: '#8a7f76', cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FBF8F5'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div
            style={{
              fontFamily: sm,
              fontSize: 10,
              letterSpacing: '.1em',
              color: '#9a8f86',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Restaurantes
          </div>
          <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
            Nuevo restaurante
          </h1>
          <p style={{ fontSize: 13, color: '#9a8f86', margin: '3px 0 0' }}>
            Crea el restaurante y su usuario administrador. El resto de la información la completa el administrador.
          </p>
        </div>
      </div>

      {/* Form */}
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 18,
          border: '1px solid #EFE7DF',
          background: '#fff',
        }}
      >
        <RestaurantForm onSuccess={goBack} onCancel={goBack} showPlanSelector variant="create-minimal" />
      </div>
    </div>
  );
}
