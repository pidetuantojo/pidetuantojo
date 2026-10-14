'use client';

import { useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';

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
  const [modal, setModal] = useState<'ios' | null>(null);

  async function handleInstall() {
    if (install.canPrompt) {
      await install.install();
      return;
    }
    if (install.needsIosSteps) setModal('ios');
  }

  const showInstall = install.canPrompt || install.needsIosSteps;

  return (
    <>
      {showInstall && (
        <button type="button" onClick={handleInstall} className={btnNeutral} title="Instalar el panel de pedidos como app">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Instalar app</span>
        </button>
      )}

      <Modal isOpen={modal === 'ios'} onClose={() => setModal(null)} title="Instalar en iPhone o iPad" size="sm">
        <div className="space-y-4 px-6 py-5">
          <IosInstallSteps />
        </div>
      </Modal>
    </>
  );
}
