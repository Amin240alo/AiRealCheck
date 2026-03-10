import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { DynamicToaster } from '@/components/ui/DynamicToaster';
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
    icon: [
      { url: '/favicon.ico', type: 'image/png', sizes: '582x582' },
      { url: '/Assets/Logos/airealcheck-Favicon.png', type: 'image/png' },
    ],
    apple: '/Assets/Logos/airealcheck-Favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e14' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply stored theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ac_theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <DynamicToaster />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
