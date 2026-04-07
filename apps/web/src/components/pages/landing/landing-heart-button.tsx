'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleWatchlistAction } from '@/lib/actions/watchlist';

interface Props {
  listingId: string;
  listingSlug: string;
  isLoggedIn: boolean;
}

export function LandingHeartButton({ listingId, listingSlug, isLoggedIn }: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    // Prevent the parent <Link> from navigating to the listing page
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      // Canonical pattern: encode the post-login intent as ?action=watch on the
      // listing page. After login, /i/[slug] reads action=watch and auto-fires
      // the toggle via the WatchButton's autoWatch effect.
      const callbackUrl = `/i/${listingSlug}?action=watch`;
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    const wasWatching = watching;
    setWatching(!wasWatching);

    startTransition(async () => {
      try {
        const result = await toggleWatchlistAction(listingId);
        if (!result.success) {
          setWatching(wasWatching);
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
