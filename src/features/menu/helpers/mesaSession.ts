// Mesa del QR recordada durante la visita: si el cliente navega, recarga o pierde el ?mesa=, la conserva.
// sessionStorage (no localStorage) a propósito: si vuelve otro día desde su casa, no debe salir "en Mesa 5".
// try/catch: en modo privado de Safari o con el almacenamiento bloqueado estas APIs pueden fallar.

const KEY = (slug: string) => `mesa:${slug}`;
// Una comida no dura más que esto
export const MESA_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

export function saveMesaSession(slug: string, mesaId: string, now = Date.now()): void {
  try { sessionStorage.setItem(KEY(slug), JSON.stringify({ mesaId, at: now })); } catch { /* sin almacenamiento */ }
}

export function readMesaSession(slug: string, now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY(slug));
    if (!raw) return null;
    const { mesaId, at } = JSON.parse(raw) as { mesaId?: unknown; at?: unknown };
    if (typeof mesaId !== 'string' || typeof at !== 'number' || now - at > MESA_SESSION_TTL_MS) {
      sessionStorage.removeItem(KEY(slug));
      return null;
    }
    return mesaId;
  } catch {
    return null;
  }
}

export function clearMesaSession(slug: string): void {
  try { sessionStorage.removeItem(KEY(slug)); } catch { /* sin almacenamiento */ }
}
