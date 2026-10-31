import { describe, it, expect, beforeEach } from 'vitest';

import { buildMesaUrl, mesaQrFileName, resolveMesaParam } from '@/features/delivery-methods/helpers/mesaQr.helpers';
import { clearMesaSession, MESA_SESSION_TTL_MS, readMesaSession, saveMesaSession } from '@/features/menu/helpers/mesaSession';
import type { Mesa } from '@/types';

const mesa = (id: string, isActive = true): Mesa => ({ id, restaurantId: 'r1', name: `Mesa ${id}`, isActive, sortOrder: 1, createdAt: '', updatedAt: '' });

describe('buildMesaUrl', () => {
  it('arma la URL con slug y mesa', () => {
    expect(buildMesaUrl('https://app.com', 'la-esquina', 'abc123')).toBe('https://app.com/la-esquina?mesa=abc123');
  });
  it('ignora la barra final del dominio', () => {
    expect(buildMesaUrl('https://app.com/', 'x', 'm1')).toBe('https://app.com/x?mesa=m1');
  });
});

describe('resolveMesaParam', () => {
  const activas = [mesa('m1'), mesa('m2')];
  it('devuelve la mesa si existe entre las activas', () => expect(resolveMesaParam('m1', activas)?.id).toBe('m1'));
  it('null si no existe (borrada o inactiva: el servidor solo pasa las activas)', () => expect(resolveMesaParam('zzz', activas)).toBeNull());
  it('null si viene repetida (?mesa=a&mesa=b)', () => expect(resolveMesaParam(['m1', 'm2'], activas)).toBeNull());
  it('null si está vacía o no viene', () => {
    expect(resolveMesaParam('', activas)).toBeNull();
    expect(resolveMesaParam(undefined, activas)).toBeNull();
  });
});

describe('mesaQrFileName', () => {
  it('normaliza tildes y espacios', () => expect(mesaQrFileName('la-esquina', 'Terraza Número 3')).toBe('qr-la-esquina-terraza-numero-3.png'));
  it('nombre sin letras ni números', () => expect(mesaQrFileName('x', '¡¡!!')).toBe('qr-x-mesa.png'));
});

describe('mesaSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('recuerda la mesa durante la visita', () => {
    saveMesaSession('la-esquina', 'm1', 1000);
    expect(readMesaSession('la-esquina', 2000)).toBe('m1');
    expect(readMesaSession('otro-local', 2000)).toBeNull();
  });

  it('vence a las 3 horas y se borra', () => {
    saveMesaSession('la-esquina', 'm1', 0);
    expect(readMesaSession('la-esquina', MESA_SESSION_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem('mesa:la-esquina')).toBeNull();
  });

  it('ignora datos corruptos y se puede limpiar', () => {
    sessionStorage.setItem('mesa:x', '{no es json');
    expect(readMesaSession('x')).toBeNull();
    saveMesaSession('x', 'm1');
    clearMesaSession('x');
    expect(readMesaSession('x')).toBeNull();
  });
});
