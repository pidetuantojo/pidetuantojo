import { NextResponse, type NextRequest } from 'next/server';

import { adminDb } from '@/lib/firebase/admin';
import { buildPanelManifest, type PanelManifestRestaurant } from '@/lib/pwa/panelManifest';
import type { Restaurant } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manifest de la PWA "Pedidos". El panel lo pide con ?r={restaurantId} después de iniciar sesión,
// así el acceso directo lleva el nombre y el logo del restaurante (datos que ya son públicos en su menú).
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('r')?.trim();
  let restaurant: PanelManifestRestaurant | null = null;

  if (restaurantId && /^[A-Za-z0-9_-]{1,128}$/.test(restaurantId)) {
    try {
      const snap = await adminDb.collection('restaurants').doc(restaurantId).get();
      const data = snap.data() as Restaurant | undefined;
      if (data?.isActive && data.name) restaurant = { name: data.name, logo: data.logo };
    } catch (error) {
      // Sin restaurante: se usa el manifest de Pide Tu Antojo
      console.error('[panel.webmanifest] No se pudo cargar el restaurante:', error);
    }
  }

  return NextResponse.json(buildPanelManifest(restaurant), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      // Corto: si el restaurante cambia el logo, el acceso directo se entera pronto
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
