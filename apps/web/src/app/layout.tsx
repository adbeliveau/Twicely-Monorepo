import type { Metadata } from 'next';
import { Open_Sans, Source_Serif_4, IBM_Plex_Mono, Outfit } from 'next/font/google';
import { Toaster } from 'sonner';
import { RouteAnnouncer } from '@/components/shared/route-announcer';
import { Providers } from '@/components/providers';
import './globals.css';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Twicely',
  description: 'Buy & sell secondhand',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${openSans.variable} ${sourceSerif.variable} ${ibmPlexMono.variable} ${outfit.variable} font-sans dark:bg-gray-900`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
          <RouteAnnouncer />
        </Providers>
      </body>
    </html>
  );
}
