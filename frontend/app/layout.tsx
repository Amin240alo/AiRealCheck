import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AIRealCheck — Verify real vs. AI',
    template: '%s — AIRealCheck',
  },
  description: 'AIRealCheck analysiert Bilder, Videos und Audio mit mehreren KI-Detektoren gleichzeitig.',
  icons: {
    icon: '/Assets/Logos/airealcheck-Favicon.png',
    apple: '/Assets/Logos/airealcheck-Favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0e14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
