import type { Metadata, Viewport } from 'next';
import { Unbounded, Manrope, DM_Mono, Lexend } from 'next/font/google';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { AuthProvider } from '@/features/auth';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import './globals.css';

const unbounded = Unbounded({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] });
const lexend = Lexend({ subsets: ['latin'], variable: '--font-logo', weight: ['700'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Pide Tu Antojo',
  description: 'Plataforma de menús y pedidos para restaurantes',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${unbounded.variable} ${manrope.variable} ${dmMono.variable} ${lexend.variable} ${manrope.className}`}>
        {/* Anti-flash: aplica el tema ANTES de que React hidrate */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}}catch(e){}` }} />

        {/* SVG defs globales — máscara compartida por todos los LogoMark */}
        <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
          <defs>
            <mask id="pta-bite" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <rect width="100" height="100" fill="#fff" />
              <circle cx="52" cy="38" r="11" fill="#000" />
              <circle cx="88" cy="22" r="17" fill="#000" />
              <circle cx="72" cy="7" r="10" fill="#000" />
              <circle cx="94" cy="42" r="10" fill="#000" />
            </mask>
          </defs>
        </svg>
        <RadixTooltip.Provider delayDuration={300}>
          <QueryProvider>
            <ThemeProvider>
              <AuthProvider>{children}</AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </RadixTooltip.Provider>
      </body>
    </html>
  );
}
