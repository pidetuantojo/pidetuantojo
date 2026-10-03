'use client';

import { useEffect } from 'react';

import { usePwaStore, type BeforeInstallPromptEvent } from '../pwa.store';

/**
 * Registra el service worker del panel (avisos push) y guarda el evento de instalación.
 * Va en el layout del panel: el menú público no instala nada.
 */
export function PwaRegister() {
  const setInstallEvent = usePwaStore((s) => s.setInstallEvent);
  const setInstalled = usePwaStore((s) => s.setInstalled);
  const setSwRegistration = usePwaStore((s) => s.setSwRegistration);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // Que no aparezca el banner automático: se ofrece con nuestro botón "Instalar app"
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => setSwRegistration(registration))
        .catch((err) => console.error('[PWA] No se pudo registrar el service worker:', err));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [setInstallEvent, setInstalled, setSwRegistration]);

  return null;
}
