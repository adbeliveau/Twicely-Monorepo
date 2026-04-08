import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import type { FeedData } from '@/lib/queries/feed';
import type { ListingCardData } from '@/types/listings';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock FeedSection to render a div with data-title so renderToStaticMarkup
// produces inspectable HTML without needing ListingGrid / real children.
vi.mock('../feed-section', () => ({
  FeedSection: ({ title, listings, emptyMessage }: {
    title: string;
    listings: ListingCardData[];
    emptyMessage?: string;
  }) => React.createElement('div', {
    'data-section': 'true',
    'data-title': title,
    'data-count': listings.length,
    'data-empty': emptyMessage ?? '',
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeListing(id: string): ListingCardData {
  return {
    id,
    slug: id,
    title: `Listing ${id}`,
    priceCents: 1000,
    originalPriceCents: null,
    condition: 'GOOD',
    brand: null,
    freeShipping: false,
    shippingCents: 500,
    primaryImageUrl: null,
    primaryImageAlt: null,
    sellerName: 'Test Seller',
    sellerUsername: 'test',
    sellerAvatarUrl: null,
    sellerAverageRating: null,
    sellerTotalReviews: 0,
    sellerShowStars: false,
  };
}

function makeFeedData(overrides: Partial<FeedData> = {}): FeedData {
  return {
    followedListings: [],
    watchlistDrops: [],
    matchedListings: [],
    boostedListings: [],
    hasInterests: false,
    trendingFallback: [],
    ...overrides,
  };
}

// ─── FeedData shape tests ─────────────────────────────────────────────────────
// These tests validate the data contract that FeedPageContent depends on.
// The component renders based on hasInterests / trendingFallback — we verify
// that the FeedData type carries the right shape for both paths.

describe('FeedData cold-start contract', () => {
  it('cold-start feed has hasInterests=false and a trendingFallback array', () => {
    const feed = makeFeedData({
      hasInterests: false,
      trendingFallback: [makeListing('t1'), makeListing('t2')],
    });
    expect(feed.hasInterests).toBe(false);
    expect(feed.trendingFallback).toHaveLength(2);
    // Personalized sections must be empty in cold-start path
    expect(feed.matchedListings).toHaveLength(0);
    expect(feed.boostedListings).toHaveLength(0);
  });

  it('personalized feed has hasInterests=true and empty trendingFallback', () => {
    const feed = makeFeedData({
      hasInterests: true,
      matchedListings: [makeListing('m1')],
      trendingFallback: [],
    });
    expect(feed.hasInterests).toBe(true);
    expect(feed.trendingFallback).toHaveLength(0);
    expect(feed.matchedListings).toHaveLength(1);
  });

  it('cold-start feed still carries followedListings (social override persists)', () => {
    const feed = makeFeedData({
      hasInterests: false,
      followedListings: [makeListing('f1')],
      trendingFallback: [makeListing('t1')],
    });
    // Social listings are independent of interest state (Canonical §9)
    expect(feed.followedListings).toHaveLength(1);
    expect(feed.trendingFallback).toHaveLength(1);
  });

  it('cold-start feed with empty trendingFallback still has correct shape', () => {
    // Even when trending query returns nothing the type is valid (not undefined)
    const feed = makeFeedData({ hasInterests: false, trendingFallback: [] });
    expect(Array.isArray(feed.trendingFallback)).toBe(true);
  });

  it('FeedData type includes trendingFallback field', () => {
    // Type-level assertion: confirm trendingFallback is part of the interface
    const feed: FeedData = makeFeedData();
    expect('trendingFallback' in feed).toBe(true);
  });
});

// ─── Component rendering logic tests ─────────────────────────────────────────
// Import the component and render via React to verify branches.
// vi.mock hoisting ensures FeedSection is mocked before the component loads.

import { renderToStaticMarkup } from 'react-dom/server';
import { FeedPageContent } from '../feed-page-content';

describe('FeedPageContent rendering', () => {
  it('cold-start: renders Trending Now section (not empty prompt) when hasInterests=false', () => {
    const feed = makeFeedData({
      hasInterests: false,
      trendingFallback: [makeListing('t1'), makeListing('t2')],
    });
    const html = renderToStaticMarkup(React.createElement(FeedPageContent, { feedData: feed }));
    expect(html).toContain('Trending Now');
    // Must NOT render the old full-page empty-state text
    expect(html).not.toContain('Your feed is empty');
  });

  it('cold-start: renders soft interest-picker banner (not blocking empty state)', () => {
    const feed = makeFeedData({ hasInterests: false, trendingFallback: [] });
    const html = renderToStaticMarkup(React.createElement(FeedPageContent, { feedData: feed }));
    // Soft CTA banner must be present
    expect(html).toContain('Choose interests');
    // The Trending Now section must also render — feed is not blocked
    expect(html).toContain('Trending Now');
  });

  it('personalized: renders Picked for you section when hasInterests=true', () => {
    const feed = makeFeedData({
      hasInterests: true,
      matchedListings: [makeListing('m1')],
    });
    const html = renderToStaticMarkup(React.createElement(FeedPageContent, { feedData: feed }));
    expect(html).toContain('Picked for you');
    expect(html).not.toContain('Trending Now');
  });

  it('personalized: does NOT render the interest-picker banner when hasInterests=true', () => {
    const feed = makeFeedData({
      hasInterests: true,
      matchedListings: [makeListing('m1')],
    });
    const html = renderToStaticMarkup(React.createElement(FeedPageContent, { feedData: feed }));
    // Soft CTA only appears in cold-start mode
    expect(html).not.toContain('Choose interests');
  });

  it('followed listings render regardless of hasInterests state', () => {
    const feed = makeFeedData({
      hasInterests: false,
      followedListings: [makeListing('f1')],
      trendingFallback: [],
    });
    const html = renderToStaticMarkup(React.createElement(FeedPageContent, { feedData: feed }));
    expect(html).toContain('New from sellers you follow');
  });
});
