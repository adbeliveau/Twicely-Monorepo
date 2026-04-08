'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleWatchlistAction } from '@/lib/actions/watchlist';

interface Props {
  listingId: string;
  listingSlug: string;
}

export function LandingHeartButton({ listingId, listingSlug }: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    // Prevent the parent <Link> from navigating to the listing page
    e.preventDefault();
    e.stopPropagation();

    const wasWatching = watching;
    setWatching(!wasWatching);

    startTransition(async () => {
      try {
        const result = await toggleWatchlistAction(listingId);
        if (!result.success) {
          setWatching(wasWatching);
          // Server says we're not authenticated → use canonical post-login
          // intent pattern: /i/[slug]?action=watch auto-fires the toggle
          // via the WatchButton's autoWatch effect after login.
          if (result.error === 'Unauthorized') {
            const callbackUrl = `/i/${listingSlug}?action=watch`;
            router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          }
        }
      } catch {
        setWatching(wasWatching);
      }
    });
  }

  return (
    <button
      type="button"
      className="prod-act"
      aria-label={watching ? 'Remove from watchlist' : 'Save to watchlist'}
      onClick={handleClick}
    >
      <Heart
        className={`size-4 ${watching ? 'fill-current text-red-500' : ''}`}
        strokeWidth={2}
      />
    </button>
  );
}
