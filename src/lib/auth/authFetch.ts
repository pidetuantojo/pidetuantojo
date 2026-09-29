'use client';

import { auth } from '@/lib/firebase/config';

/**
 * `fetch` hacia rutas API propias con el token de Firebase del usuario logueado
 * (Authorization: Bearer <idToken>). Las rutas lo verifican con `getCaller()`.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
