import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Airwave Radio',
  description: 'AI-curated music radio',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Airwave',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{ background: '#F0EFEC', fontFamily: "'Plus Jakarta Sans', var(--font-plus-jakarta), sans-serif" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
