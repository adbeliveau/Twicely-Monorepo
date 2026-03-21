'use client';

/**
 * Empty state CTA to connect first platform.
 * Source: F1.3 install prompt §2.9 Page 1
 */

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { RefreshCw } from 'lucide-react';

export function ConnectPlatformCta() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 p-12 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <RefreshCw className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Connect your first platform</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          Import your existing listings from eBay, Poshmark, and Mercari for free — no subscription required.
        </p>
      </div>
      <Button asChild>
        <Link href="/my/selling/crosslist/connect">Connect a platform</Link>
      </Button>
    </div>
  );
}
