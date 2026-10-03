'use client';

import { useState } from 'react';
import { Bell, BellOff, BellRing, Download, Share, SquarePlus } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { useToastStore } from '@/store/toast.store';

import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePwaInstall } from '../hooks/usePwaInstall';

const btnBase = 'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors';
const btnNeutral = `${btnBase} border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text-2)] hover:bg-[var(--t-surface-2)]`;

/** Pasos para instalar en iPhone/iPad (Safari no tiene botón de instalar). */
function IosInstallSteps() {
  return (
    <ol className="space-y-2 text-sm text-[var(--t-text-2)]">
      <li className="flex items-start gap-2">
        <span className="font-bold text-orange-500">1.</span>
        <span>Abre este panel en <strong>Safari</strong>.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="font-bold text-orange-500">2.</span>
        <span>Toca <Share className="mx-0.5 inline h-4 w-4 align-text-bottom" aria-label="Compartir" /> <strong>Compartir</strong> (abajo, en el centro).</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="font-bold text-orange-500">3.</span>
        <span>Elige <SquarePlus className="mx-0.5 inline h-4 w-4 align-text-bottom" aria-hidden="true" /> <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="font-bold text-orange-500">4.</span>
        <span>Abre <strong>Pedidos</strong> desde el ícono nuevo en tu pantalla de inicio.</span>
      </li>
    </ol>
  );
}

/**
 * "Instalar app" + "Avisos de pedidos" en el encabezado de Pedidos.
 * Los avisos se activan por dispositivo (cada celular, tablet o PC del restaurante).
 */
export function PwaControls() {
  const install = usePwaInstall();
  const push = usePushNotifications();
  const { showToast } = useToastStore();
  const [modal, setModal] = useState<'push' | 'ios' | null>(null);
  const [error, setError] = useState('');

  async function handleInstall() {
    if (install.canPrompt) {
      const outcome = await install.install();
      if (outcome === 'accepted') showToast('¡Listo! Abre "Pedidos" desde el ícono de la app');
      return;
    }
    if (install.needsIosSteps) setModal('ios');
  }

  async function run(action: () => Promise<unknown>, success?: string) {
    setError('');
    try {
      await action();
      if (success) showToast(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.');
    }
  }

  async function handleTest() {
    await run(async () => {
      const sent = await push.sendTest();
      if (sent === 0) throw new Error('No hay dispositivos con avisos activos. Actívalos de nuevo.');
    }, 'Prueba enviada: debería llegarte en unos segundos');
  }

  const showInstall = install.canPrompt || install.needsIosSteps;
  const bellIcon = push.enabled ? <BellRing className="h-4 w-4" /> : push.permission === 'denied' ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />;

  return (
    <>
      {showInstall && (
        <button type="button" onClick={handleInstall} className={btnNeutral} title="Instalar el panel de pedidos como app">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Instalar app</span>
        </button>
      )}

      {push.support !== null && (
        <button
          type="button"
          onClick={() => { setError(''); setModal('push'); }}
          title="Avisos de pedidos nuevos con la app cerrada"
          className={push.enabled
            ? `${btnBase} border-green-300 bg-green-50 text-green-700 hover:bg-green-100`
            : btnNeutral}
        >
          {bellIcon}
          <span className="hidden sm:inline">{push.enabled ? 'Avisos activos' : 'Activar avisos'}</span>
        </button>
      )}

      <Modal isOpen={modal === 'ios'} onClose={() => setModal(null)} title="Instalar en iPhone o iPad" size="sm">
        <div className="space-y-4 px-6 py-5">
          <IosInstallSteps />
          <p className="text-xs text-[var(--t-text-4)]">Instalada, también puedes activar los avisos de pedidos nuevos (iOS 16.4 o superior).</p>
        </div>
      </Modal>

      <Modal
        isOpen={modal === 'push'}
        onClose={() => setModal(null)}
        title="Avisos de pedidos nuevos"
        description="Te avisamos en este dispositivo aunque la app esté cerrada o la pantalla bloqueada."
        size="md"
      >
        <div className="space-y-4 px-6 py-5 text-sm text-[var(--t-text-2)]">
          {push.support === 'ios_install' && (
            <>
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                En iPhone y iPad los avisos solo funcionan con la app <strong>instalada en la pantalla de inicio</strong> (iOS 16.4 o superior).
              </p>
              <IosInstallSteps />
            </>
          )}

          {push.support === 'unsupported' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Este navegador no permite avisos. Usa <strong>Chrome</strong> en Android o en el PC, o instala la app en iPhone.
            </p>
          )}

          {push.support === 'not_configured' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Los avisos todavía no están configurados en la plataforma. Avísale al administrador.
            </p>
          )}

          {push.support === 'ready' && (
            <>
              {push.permission === 'denied' && !push.enabled && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  Bloqueaste las notificaciones para este sitio. Toca el candado junto a la dirección → <strong>Notificaciones</strong> → <strong>Permitir</strong>, y vuelve a intentarlo.
                </p>
              )}

              {push.enabled ? (
                <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-green-900">
                  <BellRing className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Avisos activos en este dispositivo</p>
                    <p className="mt-0.5 text-green-800">Cuando entre un pedido por el menú te llega una notificación. Tócala para abrir el pedido.</p>
                  </div>
                </div>
              ) : (
                <p>
                  Activa los avisos en <strong>cada dispositivo</strong> donde quieras enterarte de los pedidos: el celular del cajero,
                  la tablet de cocina o el PC de la caja.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {push.enabled ? (
                  <>
                    <button type="button" disabled={push.busy} onClick={handleTest} className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
                      {push.busy ? 'Enviando...' : 'Enviar prueba'}
                    </button>
                    <button type="button" disabled={push.busy} onClick={() => run(push.disable, 'Avisos desactivados en este dispositivo')} className={`${btnNeutral} disabled:opacity-60`}>
                      Desactivar
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={push.busy} onClick={() => run(push.enable, 'Avisos activados en este dispositivo')} className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
                    {push.busy ? 'Activando...' : 'Activar avisos en este dispositivo'}
                  </button>
                )}
              </div>
            </>
          )}

          {error && <p role="alert" className="text-red-600">{error}</p>}

          <p className="border-t border-[var(--t-border)] pt-3 text-xs text-[var(--t-text-4)]">
            Deja el sonido del dispositivo activado: el modo <strong>No molestar</strong> o el ahorro de batería pueden silenciar o retrasar los avisos.
            Con esta pantalla abierta no llega la notificación del sistema: suena el aviso de voz de siempre.
          </p>
        </div>
      </Modal>
    </>
  );
}
