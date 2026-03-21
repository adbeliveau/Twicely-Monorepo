'use client';

/**
 * Enhanced empty state for first-time crosslister users.
 * Replaces ConnectPlatformCta when seller has no connected accounts.
 * Source: G1-C install prompt §File 2
 */

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';
import { Link as LinkIcon, Download, Globe, Zap, Clock, Tag } from 'lucide-react';

export function CrosslisterOnboardingEmpty() {
  return (
    <div className="space-y-8">
      {/* Section 1: Hero Banner */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 p-12 text-center space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Manage all your listings in one place</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Import your existing inventory from eBay, Poshmark, and Mercari — completely free.
            No subscription required.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/my/selling/crosslist/connect">Connect a platform</Link>
        </Button>
      </div>

      {/* Section 2: How It Works */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">How it works</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center space-y-2 p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <LinkIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 1
            </div>
            <p className="font-medium">Connect your account</p>
            <p className="text-sm text-muted-foreground">
              Link your eBay, Poshmark, or Mercari account securely.
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-2 p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2
            </div>
            <p className="font-medium">Import your listings</p>
            <p className="text-sm text-muted-foreground">
              Your existing listings are imported to Twicely instantly. Always free, always active.
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-2 p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 3
            </div>
            <p className="font-medium">Sell everywhere</p>
            <p className="text-sm text-muted-foreground">
              Manage and crosslist from one dashboard. Upgrade anytime for more features.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Key Facts */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
            <Tag className="h-6 w-6 text-primary" />
            <p className="font-semibold">Always free</p>
            <p className="text-sm text-muted-foreground">
              Your first import from each platform costs nothing. No hidden fees.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
            <Zap className="h-6 w-6 text-primary" />
            <p className="font-semibold">Go live instantly</p>
            <p className="text-sm text-muted-foreground">
              Imported listings are active on Twicely immediately — no review queue.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
            <Clock className="h-6 w-6 text-primary" />
            <p className="font-semibold">No subscription needed</p>
            <p className="text-sm text-muted-foreground">
              Import without any crosslister subscription. Upgrade later if you want to crosslist.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
