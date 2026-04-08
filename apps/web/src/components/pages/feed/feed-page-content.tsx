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
 *
 * Cold-start (no interests): renders trending fallback feed + soft interest
 * picker banner. Per Canonical §4: skip = generic trending feed, not empty state.
 */
export function FeedPageContent({ feedData }: Props) {
  const {
    followedListings,
    matchedListings,
    boostedListings,
    hasInterests,
    trendingFallback,
  } = feedData;

  return (
    <div className="space-y-10">
      {/* Soft interest-picker banner — shown when user has no interests.
          Demoted from full-page empty state to a non-blocking suggestion.
          Per Canonical §4: "no degraded experience, no nag screens, just a suggestion." */}
      {!hasInterests && (
        <div className="rounded-lg border border-dashed p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Personalize your feed — pick interests to see listings matched to what you love.
          </p>
          <a
            href="/my/settings"
            className="shrink-0 text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            Choose interests
          </a>
        </div>
      )}

      {/* Section 1 — Social override */}
      {followedListings.length > 0 && (
        <FeedSection
          title="New from sellers you follow"
          listings={followedListings}
        />
      )}

      {/* Section 2 — Watchlist drops (deferred G3.9) */}

      {/* Section 3 — Interest-matched OR cold-start trending fallback.
          Per Canonical §4 and §5: no interests → Explore tab behavior (trending). */}
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
        <FeedSection
          title="Trending Now"
          listings={trendingFallback}
          emptyMessage={
            trendingFallback.length === 0
              ? 'No trending listings right now — check back soon.'
              : undefined
          }
        />
      )}

      {/* Section 4 — Promoted matching interests (only shown when interests exist) */}
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
