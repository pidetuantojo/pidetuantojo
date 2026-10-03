'use client';

// Firebase Cloud Messaging en el navegador: solo se usa para obtener el token del dispositivo.
// Las notificaciones las muestra nuestro service worker (public/sw.js), no el de Firebase.
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';

import app from './config';

// Firebase Console → Configuración del proyecto → Cloud Messaging → Certificados push web
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

export async function getPushToken(registration: ServiceWorkerRegistration): Promise<string> {
  if (!VAPID_KEY) throw new Error('Los avisos no están configurados (falta la clave VAPID).');
  if (!(await isSupported())) throw new Error('Este navegador no permite avisos push.');
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

export async function deletePushToken(): Promise<void> {
  if (!(await isSupported())) return;
  await deleteToken(getMessaging(app)).catch(() => false);
}
