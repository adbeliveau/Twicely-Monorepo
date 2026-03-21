'use client';

import { FeedSection } from './feed-section';
import type { FeedData } from '@/lib/queries/feed';

interface Props {
  feedData: FeedData;
}

/**
 * Client component orchestrating all four feed sections.
 * Section order per Personalization Canonical §13:
 *   1. New from sellers you follow
 *   2. Price drops on your watchlist (deferred G3.9)
 *   3. Picked for you (interest-matched)
 *   4. Promoted (boosted matching interests)
 */
export function FeedPageContent({ feedData }: Props) {
  const {
    followedListings,
    matchedListings,
    boostedListings,
    hasInterests,
  } = feedData;

  const isEmpty =
    followedListings.length === 0 &&
    matchedListings.length === 0 &&
    boostedListings.length === 0;

  if (isEmpty && !hasInterests) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">
          Your feed is empty. Follow sellers or pick your interests to see personalized recommendations.
        </p>
        <a
          href="/my/settings"
          className="inline-block text-sm font-medium underline underline-offset-4 hover:no-underline"
        >
          Personalize your feed
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Section 1 — Social override */}
      {followedListings.length > 0 && (
        <FeedSection
          title="New from sellers you follow"
          listings={followedListings}
        />
      )}

      {/* Section 2 — Watchlist drops (deferred G3.9) */}

      {/* Section 3 — Interest-matched */}
      {hasInterests ? (
        <FeedSection
          title="Picked for you"
          listings={matchedListings}
          emptyMessage={
            matchedListings.length === 0
              ? 'No new listings matching your interests right now.'
              : undefined
          }
        />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Pick your interests to see personalized recommendations.
          </p>
          <a
            href="/my/settings"
            className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            Choose interests
          </a>
        </div>
      )}

      {/* Section 4 — Promoted matching interests */}
      {boostedListings.length > 0 && (
        <FeedSection
          title="Promoted"
          listings={boostedListings}
          showPromoted
        />
      )}
    </div>
  );
}
