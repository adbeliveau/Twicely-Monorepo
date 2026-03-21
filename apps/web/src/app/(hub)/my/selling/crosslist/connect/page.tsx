/**
 * Connect platform page — /my/selling/crosslist/connect
 * Page Registry Row 57: SELLER or DELEGATE(crosslister.manage)
 * Source: F1.3 install prompt §2.9 Page 2
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { ConnectPlatformGrid } from '@/components/crosslister/connect-platform-grid';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect Platform | Twicely',
  robots: 'noindex',
};

interface ConnectPageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function ConnectPlatformPage({ searchParams }: ConnectPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist/connect');
  }

  if (!session.user.isSeller) {
    redirect('/my/selling/onboarding');
  }

  const params = await searchParams;
  const connected = params.connected;
  const error = params.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/my/selling/crosslist"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Crosslister
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Connect a platform</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import your listings from other marketplaces for free. No subscription required.
        </p>
      </div>

      {connected && (
        <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm font-medium">
          {connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully!
        </div>
      )}

      {error === 'auth_failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm font-medium">
          Failed to connect account. Please try again.
        </div>
      )}

      <ConnectPlatformGrid />
    </div>
  );
}
