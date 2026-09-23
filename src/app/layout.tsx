import type { Metadata } from 'next';
import { Unbounded, Manrope, DM_Mono } from 'next/font/google';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { AuthProvider } from '@/features/auth';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

const unbounded = Unbounded({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Antojo App',
  description: 'Plataforma de menús y pedidos para restaurantes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${unbounded.variable} ${manrope.variable} ${dmMono.variable} ${manrope.className}`}>
        <RadixTooltip.Provider delayDuration={300}>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </RadixTooltip.Provider>
      </body>
    </html>
  );
}
