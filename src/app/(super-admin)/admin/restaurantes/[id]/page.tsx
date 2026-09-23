'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, KeyRound } from 'lucide-react';

import { useRestaurant } from '@/features/restaurants/hooks/useRestaurants';
import { RestaurantForm } from '@/features/restaurants/components/RestaurantForm';
import { MenuPreview } from '@/features/restaurants/components/RestaurantForm/MenuPreview';
import { Modal } from '@/components/ui/Modal';
import type { RestaurantColorsPayload } from '@/features/restaurants/components/RestaurantForm/RestaurantForm.types';

const sg = "var(--font-sans, sans-serif)";

const DEFAULT_COLORS: RestaurantColorsPayload = {
  pri: '#F59211',
  sec: '#1F5130',
  acc: '#FFE7C4',
  bg: '#FBF3E9',
  name: '',
  layout: 'cards',
  logo: '',
  bannerImage: '',
};

export default function EditarRestaurantePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: restaurant, isLoading } = useRestaurant(id);
  const [colors, setColors] = useState<RestaurantColorsPayload>(DEFAULT_COLORS);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  function goBack() {
    router.push('/admin/restaurantes');
  }

  function openPasswordModal() {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setPasswordError('');
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/restaurants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: restaurant!.adminUserId, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Error al cambiar la contraseña');
      }
      setShowPasswordModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: sg,
        display: 'flex',
        height: 'calc(100vh - 64px)',
        gap: 32,
        overflow: 'hidden',
      }}
    >
      {/* Left column — scrolls */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingRight: 4,
          paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 11,
              border: '1.5px solid #E7DED6',
              background: '#fff',
              color: '#8a7f76',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
              {restaurant ? `Editar: ${restaurant.name}` : 'Editar restaurante'}
            </h1>
            <p style={{ fontSize: 13, color: '#9a8f86', margin: '3px 0 0' }}>
              Actualizá la información del restaurante.
            </p>
          </div>
          {restaurant && (
            <button
              onClick={openPasswordModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: sg, fontWeight: 600, fontSize: 13,
                color: '#6b7280', background: '#f3f4f6',
                border: '1.5px solid #E7DED6', borderRadius: 10,
                padding: '9px 16px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <KeyRound size={14} />
              Cambiar contraseña
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '4px solid #FF6A1A',
                borderTopColor: 'transparent',
                display: 'block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          </div>
        ) : !restaurant ? (
          <div style={{ borderRadius: 18, border: '1px solid #EFE7DF', background: '#fff', padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9a8f86' }}>Restaurante no encontrado.</p>
          </div>
        ) : (
          <div style={{ overflow: 'hidden', borderRadius: 18, border: '1px solid #EFE7DF', background: '#fff', flexShrink: 0 }}>
            <RestaurantForm
              restaurant={restaurant}
              onSuccess={goBack}
              onCancel={goBack}
              onColorsChange={setColors}
            />
          </div>
        )}
      </div>

      {/* Modal cambiar contraseña */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Cambiar contraseña"
        description={`Establecé una nueva contraseña para el admin de ${restaurant?.name ?? 'este restaurante'}.`}
        size="sm"
      >
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: sg }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
              style={{
                fontFamily: sg, fontSize: 14, color: '#1B1512',
                border: '1.5px solid #E7DED6', background: '#fff',
                borderRadius: 10, padding: '10px 14px', outline: 'none',
                opacity: passwordLoading ? 0.6 : 1,
              }}
              onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: sg }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              placeholder="Repetí la contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              style={{
                fontFamily: sg, fontSize: 14, color: '#1B1512',
                border: '1.5px solid #E7DED6', background: '#fff',
                borderRadius: 10, padding: '10px 14px', outline: 'none',
                opacity: passwordLoading ? 0.6 : 1,
              }}
              onFocus={(e) => { e.target.style.borderColor = '#FF6A1A'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
            />
          </div>
          {passwordError && (
            <p style={{ fontSize: 13, color: '#dc2626', margin: 0, fontFamily: sg }}>{passwordError}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => setShowPasswordModal(false)}
              disabled={passwordLoading}
              style={{
                fontFamily: sg, fontWeight: 600, fontSize: 14,
                color: '#6b7280', background: '#f3f4f6',
                border: 0, borderRadius: 10, padding: '10px 20px',
                cursor: passwordLoading ? 'not-allowed' : 'pointer',
                opacity: passwordLoading ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading}
              style={{
                fontFamily: sg, fontWeight: 600, fontSize: 14,
                color: '#fff', background: 'linear-gradient(135deg, #FF8A2B, #FF6A1A 55%, #EA3B2E)',
                border: 0, borderRadius: 10, padding: '10px 20px',
                cursor: passwordLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: passwordLoading ? 0.8 : 1,
                minWidth: 150, justifyContent: 'center',
              }}
            >
              {passwordLoading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff', display: 'inline-block',
                    animation: 'spin 0.7s linear infinite', flexShrink: 0,
                  }} />
                  Guardando...
                </>
              ) : 'Guardar contraseña'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast de éxito */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#1B1512', color: '#fff',
          fontFamily: sg, fontWeight: 500, fontSize: 14,
          borderRadius: 14, padding: '14px 20px',
          boxShadow: '0 8px 32px -8px rgba(0,0,0,.45)',
          animation: 'slideUp 0.25s ease',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#3F9E6A', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Contraseña actualizada correctamente
          <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}

      {/* Right column — always fixed */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          alignSelf: 'flex-start',
          paddingTop: 4,
        }}
      >
        <div
          style={{
            fontFamily: sg,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.08em',
            color: '#9a8f86',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF6A1A', display: 'inline-block' }} />
          Vista previa del menú
        </div>
        <div
          style={{
            width: 300,
            height: 620,
            borderRadius: 40,
            border: '8px solid #1B1512',
            overflow: 'hidden',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,.35)',
            background: '#fff',
          }}
        >
          <MenuPreview
            pri={colors.pri}
            sec={colors.sec}
            acc={colors.acc}
            bg={colors.bg}
            name={colors.name}
            layout={colors.layout}
            logo={colors.logo}
            bannerImage={colors.bannerImage}
          />
        </div>
      </div>
    </div>
  );
}
