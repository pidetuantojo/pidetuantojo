import type { Metadata } from 'next';

import { RegistroLocalForm } from '@/features/leads/RegistroLocalForm';

export const metadata: Metadata = {
  title: 'Registra tu local — Pide Tu Antojo',
  description: 'Suma tu restaurante a la plataforma y empieza a recibir pedidos por WhatsApp hoy mismo.',
};

export default function RegistrarLocalPage() {
  return <RegistroLocalForm />;
}
