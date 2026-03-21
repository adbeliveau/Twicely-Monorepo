'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface AffiliateClickTrackerProps {
  listingId: string;
  listingSlug: string;
}

export function AffiliateClickTracker({ listingId, listingSlug }: AffiliateClickTrackerProps) {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    if (!refCode) return;

    fetch('/api/affiliate/listing-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCode: refCode,
        listingId,
        listingSlug,
      }),
    }).catch(() => {});

    // Clean URL — remove ?ref= from browser bar without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  }, [refCode, listingId, listingSlug]);

  return null;
}
