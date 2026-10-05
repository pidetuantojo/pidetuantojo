import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { panelMetadata, panelViewport } from '@/lib/pwa/panelMetadata';

// PWA "Pedidos": manifest, ícono de iPhone y color de la barra (solo en el panel)
export const metadata = panelMetadata;
export const viewport = panelViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
