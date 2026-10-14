'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Muestra alerta cuando WhatsApp se desconecta de forma espontánea.
 * SOLO se activa si el WA alguna vez estuvo conectado en este restaurante
 * (guardado en localStorage). Si nunca se conectó, no pasa nada.
 */
export function useWaDisconnectAlert(restaurantId: string) {
  const [showAlert, setShowAlert] = useState(false);
  const wasEverConnected = useRef(false);
  const prevConnected = useRef(false);

  useEffect(() => {
    if (!restaurantId) return;

    // Leer si alguna vez estuvo conectado
    try {
      wasEverConnected.current = localStorage.getItem(`wa-connected-${restaurantId}`) === 'true';
    } catch {}

    async function check() {
      try {
        const res = await fetch(`/api/whatsapp/connect?restaurantId=${restaurantId}`);
        const data: { status: string } = await res.json();

        if (data.status === 'connected') {
          prevConnected.current = true;
          wasEverConnected.current = true;
          // Persistir para futuros reinicios de sesión
          try { localStorage.setItem(`wa-connected-${restaurantId}`, 'true'); } catch {}
          // Ocultar alerta si reconectó
          setShowAlert(false);
        } else if (
          data.status === 'disconnected' &&
          prevConnected.current &&
          wasEverConnected.current
        ) {
          // Solo alertar si efectivamente estaba conectado esta sesión
          setShowAlert(true);
        }
      } catch {
        // Silencioso — no romper si falla el fetch
      }
    }

    check();
    // Poll cada 30 segundos
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  function dismiss() { setShowAlert(false); }

  return { showAlert, dismiss };
}
