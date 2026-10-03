import { create } from 'zustand';

/** Evento de Chrome/Edge para mostrar "Instalar app" cuando el usuario quiera (no es estándar). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaStore {
  // Se guarda apenas llega (puede llegar antes de que se monte el botón)
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  setInstallEvent: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
  setSwRegistration: (r: ServiceWorkerRegistration | null) => void;
}

export const usePwaStore = create<PwaStore>((set) => ({
  installEvent: null,
  installed: false,
  swRegistration: null,
  setInstallEvent: (installEvent) => set({ installEvent }),
  setInstalled: (installed) => set({ installed }),
  setSwRegistration: (swRegistration) => set({ swRegistration }),
}));

/** ¿Está abierta como app instalada? */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
