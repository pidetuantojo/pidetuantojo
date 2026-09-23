import type { Metadata } from 'next';

import { RegistroLocalForm } from '@/features/leads/RegistroLocalForm';

export const metadata: Metadata = {
  title: 'Registrá tu local — Pide Tu Antojo',
  description: 'Sumá tu restaurante a la plataforma y empezá a recibir pedidos por WhatsApp hoy mismo.',
};

export default function RegistrarLocalPage() {
  return <RegistroLocalForm />;
}
