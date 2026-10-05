// Detección de plataforma y soporte de avisos (lógica pura: la usan los hooks y los tests).

export type DevicePlatform = 'ios' | 'android' | 'desktop';

/** iPadOS se presenta como Mac: se reconoce por la pantalla táctil. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): DevicePlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && maxTouchPoints > 1)) return 'ios';
  if (ua.includes('android')) return 'android';
  return 'desktop';
}

export interface PushEnvironment {
  platform: DevicePlatform;
  // Abierta como app instalada (display-mode: standalone / navigator.standalone)
  isStandalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  // Clave VAPID de Firebase configurada (NEXT_PUBLIC_FIREBASE_VAPID_KEY)
  isConfigured: boolean;
}

/**
 * - ready: se pueden activar los avisos en este dispositivo
 * - ios_install: iPhone/iPad solo recibe push con la app instalada en la pantalla de inicio (iOS 16.4+)
 * - unsupported: navegador sin push (ej. iOS viejo, navegadores dentro de otras apps)
 * - not_configured: falta la clave VAPID en el servidor
 */
export type PushSupport = 'ready' | 'ios_install' | 'unsupported' | 'not_configured';

export function getPushSupport(env: PushEnvironment): PushSupport {
  if (env.platform === 'ios' && !env.isStandalone) return 'ios_install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  if (!env.isConfigured) return 'not_configured';
  return 'ready';
}
