'use client';

import { useRef, useState, useCallback } from 'react';

const STORAGE_KEY = 'dash-voice-enabled';

export function useVoiceNotifications() {
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const enabledRef = useRef(true);

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== 'false'; // default: activado
  });

  // Mantener la ref sincronizada sin triggear re-renders en announce
  enabledRef.current = enabled;

  // drainRef para que la llamada recursiva siempre use la versión más fresca
  const drainRef = useRef<() => void>(() => {});
  drainRef.current = function drain() {
    if (speakingRef.current || queueRef.current.length === 0) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const text = queueRef.current.shift()!;
    speakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      speakingRef.current = false;
      drainRef.current();
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      drainRef.current();
    };

    window.speechSynthesis.speak(utterance);
  };

  /** Encola un texto para hablar. Si hay voz hablando, espera su turno. */
  const announce = useCallback((text: string) => {
    if (!enabledRef.current) return;
    queueRef.current.push(text);
    drainRef.current();
  }, []);

  /** Activa o desactiva las notificaciones de voz. Si se desactiva, cancela la voz en curso. */
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        queueRef.current = [];
        speakingRef.current = false;
      }
      return next;
    });
  }, []);

  return { announce, enabled, toggle };
}
