'use client';

/**
 * Dismissible banner shown when seller has connected accounts but no completed imports.
 * Source: G1-C install prompt §File 3
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { X } from 'lucide-react';

const DISMISS_KEY = 'twicely:import-guide-dismissed';

export interface ImportGuideBannerProps {
  connectedChannels: string[];
  hasCompletedImport: boolean;
}

export function ImportGuideBanner({
  connectedChannels,
  hasCompletedImport,
}: ImportGuideBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      setDismissed(true);
    }
  }, []);

  if (!mounted) return null;
  if (hasCompletedImport) return null;
  if (connectedChannels.length === 0) return null;
  if (dismissed) return null;

  const platformName = connectedChannels[0] ?? '';
  const extraCount = connectedChannels.length - 1;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3 gap-4">
      <p className="text-sm flex-1">
        <span className="font-medium">Ready to import your listings?</span>{' '}
        {extraCount > 0
          ? `You've connected ${platformName} and ${extraCount} other platform${extraCount > 1 ? 's' : ''}.`
          : `You've connected ${platformName}.`}{' '}
        Import your existing listings to Twicely for free — they&apos;ll be active immediately.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm">
          <Link href="/my/selling/crosslist/import">Start importing</Link>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
