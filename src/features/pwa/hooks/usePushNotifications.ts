'use client';

import { useCallback, useEffect, useState } from 'react';

import { authFetch } from '@/lib/auth/authFetch';
import { deletePushToken, getPushToken, VAPID_KEY } from '@/lib/firebase/messaging';
import { detectPlatform, getPushSupport, type DevicePlatform, type PushSupport } from '@/lib/pwa/platform';

import { isStandaloneDisplay, usePwaStore } from '../pwa.store';

// Token registrado en ESTE dispositivo (los avisos se activan por dispositivo)
const TOKEN_KEY = 'push-token';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Navegación privada: los avisos funcionan igual, solo no se recuerda el estado
  }
}

async function serverError(response: Response, fallback: string): Promise<Error> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return new Error(data.error ?? fallback);
}

export interface PushNotificationsState {
  // null mientras se detecta (solo en el cliente)
  support: PushSupport | null;
  permission: NotificationPermission | 'unsupported';
  // Activos en este dispositivo
  enabled: boolean;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<number>;
}

export function usePushNotifications(): PushNotificationsState {
  const swRegistration = usePwaStore((s) => s.swRegistration);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const detected = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(detected);
    setSupport(getPushSupport({
      platform: detected,
      isStandalone: isStandaloneDisplay(),
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
      isConfigured: !!VAPID_KEY,
    }));
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    setPermission(perm);
    setEnabled(perm === 'granted' && !!readStoredToken());
  }, []);

  const registration = useCallback(async (): Promise<ServiceWorkerRegistration> => {
    if (swRegistration) return swRegistration;
    return navigator.serviceWorker.ready;
  }, [swRegistration]);

  // El token de FCM puede cambiar: al abrir el panel se renueva en silencio
  useEffect(() => {
    if (support !== 'ready' || !enabled) return;
    let active = true;
    (async () => {
      try {
        const token = await getPushToken(await registration());
        if (!active || token === readStoredToken()) return;
        const res = await authFetch('/api/push/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, platform }),
        });
        if (res.ok) storeToken(token);
      } catch {
        // Sin conexión o permiso revocado: se reintenta la próxima vez
      }
    })();
    return () => { active = false; };
  }, [support, enabled, registration, platform]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      // Primero el permiso (iPhone exige que salga directo del toque del usuario)
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error(result === 'denied'
          ? 'Bloqueaste las notificaciones. Habilítalas en la configuración del navegador para este sitio.'
          : 'Necesitamos tu permiso para mostrar los avisos.');
      }
      const token = await getPushToken(await registration());
      const res = await authFetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      });
      if (!res.ok) throw await serverError(res, 'No se pudieron activar los avisos.');
      storeToken(token);
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  }, [registration, platform]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const token = readStoredToken();
      if (token) {
        await authFetch('/api/push/register', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => undefined);
      }
      await deletePushToken();
      storeToken(null);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/push/test', { method: 'POST' });
      if (!res.ok) throw await serverError(res, 'No se pudo enviar la prueba.');
      const { sent } = (await res.json()) as { sent: number };
      return sent;
    } finally {
      setBusy(false);
    }
  }, []);

  return { support, permission, enabled, busy, enable, disable, sendTest };
}
