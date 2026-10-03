import { panelMetadata, panelViewport } from '@/lib/pwa/panelMetadata';

// El login es parte de la app instalada (si la sesión vence, se vuelve a entrar sin salir de la app)
export const metadata = panelMetadata;
export const viewport = panelViewport;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
