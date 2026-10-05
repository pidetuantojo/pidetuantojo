'use client';

import { useCallback, useEffect, useState } from 'react';

import { detectPlatform, type DevicePlatform } from '@/lib/pwa/platform';

import { isStandaloneDisplay, usePwaStore } from '../pwa.store';

export interface PwaInstallState {
  platform: DevicePlatform;
  // Ya está abierta como app
  isStandalone: boolean;
  // Chrome/Edge ofrecen instalar con un toque
  canPrompt: boolean;
  // iPhone/iPad: se instala a mano desde Safari (Compartir → Agregar a inicio)
  needsIosSteps: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): PwaInstallState {
  const installEvent = usePwaStore((s) => s.installEvent);
  const installed = usePwaStore((s) => s.installed);
  const setInstallEvent = usePwaStore((s) => s.setInstallEvent);
  // Se lee en el cliente (en el servidor no hay navigator): evita diferencias de hidratación
  const [env, setEnv] = useState<{ platform: DevicePlatform; standalone: boolean }>({ platform: 'desktop', standalone: false });

  useEffect(() => {
    setEnv({ platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints), standalone: isStandaloneDisplay() });
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return 'unavailable' as const;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    return outcome;
  }, [installEvent, setInstallEvent]);

  const isStandalone = env.standalone || installed;
  return {
    platform: env.platform,
    isStandalone,
    canPrompt: !isStandalone && !!installEvent,
    needsIosSteps: !isStandalone && env.platform === 'ios',
    install,
  };
}
