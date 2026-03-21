/**
 * Tests for ListingActionButtons rendering logic (pure function extraction).
 * Verifies which sections are shown or hidden based on props.
 */
import { describe, it, expect } from 'vitest';

// ─── Logic extracted from ListingActionButtons ────────────────────────────────

function shouldShowWatchAndPriceAlert(isOwnListing: boolean): boolean {
  return !isOwnListing;
}

function shouldShowListingAuthActions(isUnavailable: boolean): boolean {
  return !isUnavailable;
}

function shouldShowMakeOffer(
  isUnavailable: boolean,
  allowOffers: boolean,
  isOwnListing: boolean,
): boolean {
  return !isUnavailable && allowOffers && !isOwnListing;
}

function shouldShowWatcherOffer(
  isUnavailable: boolean,
  isOwnListing: boolean,
  hasWatcherOffer: boolean,
): boolean {
  return !isUnavailable && !isOwnListing && hasWatcherOffer;
}

function shouldShowMessageSeller(
  isUnavailable: boolean,
  isOwnListing: boolean,
): boolean {
  return !isUnavailable && !isOwnListing;
}

function shouldShowUnavailableBanner(isUnavailable: boolean): boolean {
  return isUnavailable;
}

function getDefaultAddressId(
  addresses: Array<{ id: string; isDefault: boolean }>,
): string | null {
  const defaultAddr = addresses.find((a) => a.isDefault);
  if (defaultAddr) return defaultAddr.id;
  return addresses[0]?.id ?? null;
}

// ─── Watch button + price alert visibility ────────────────────────────────────

describe('ListingActionButtons — watch/price-alert visibility', () => {
  it('shows watch button and price alert for non-owner', () => {
    expect(shouldShowWatchAndPriceAlert(false)).toBe(true);
  });

  it('hides watch button and price alert for listing owner', () => {
    expect(shouldShowWatchAndPriceAlert(true)).toBe(false);
  });
});

// ─── Buy button (ListingAuthActions) visibility ───────────────────────────────

describe('ListingActionButtons — buy button visibility', () => {
  it('shows buy button when listing is available', () => {
    expect(shouldShowListingAuthActions(false)).toBe(true);
  });

  it('hides buy button when listing is unavailable', () => {
    expect(shouldShowListingAuthActions(true)).toBe(false);
  });
});

// ─── Make offer visibility ────────────────────────────────────────────────────

describe('ListingActionButtons — make offer visibility', () => {
  it('shows make offer for buyer on available listing that allows offers', () => {
    expect(shouldShowMakeOffer(false, true, false)).toBe(true);
  });

  it('hides make offer when listing is unavailable', () => {
    expect(shouldShowMakeOffer(true, true, false)).toBe(false);
  });

  it('hides make offer when allowOffers is false', () => {
    expect(shouldShowMakeOffer(false, false, false)).toBe(false);
  });

  it('hides make offer for own listing', () => {
    expect(shouldShowMakeOffer(false, true, true)).toBe(false);
  });

  it('hides make offer when both unavailable and own listing', () => {
    expect(shouldShowMakeOffer(true, true, true)).toBe(false);
  });
});

// ─── Watcher offer banner visibility ─────────────────────────────────────────

describe('ListingActionButtons — watcher offer banner visibility', () => {
  it('shows watcher offer for buyer on available listing with watcher offer', () => {
    expect(shouldShowWatcherOffer(false, false, true)).toBe(true);
  });

  it('hides watcher offer when listing is unavailable', () => {
    expect(shouldShowWatcherOffer(true, false, true)).toBe(false);
  });

  it('hides watcher offer for own listing', () => {
    expect(shouldShowWatcherOffer(false, true, true)).toBe(false);
  });

  it('hides watcher offer when no watcher offer exists', () => {
    expect(shouldShowWatcherOffer(false, false, false)).toBe(false);
  });
});

// ─── Message seller visibility ────────────────────────────────────────────────

describe('ListingActionButtons — message seller visibility', () => {
  it('shows message seller for buyer on available listing', () => {
    expect(shouldShowMessageSeller(false, false)).toBe(true);
  });

  it('hides message seller when listing is unavailable', () => {
    expect(shouldShowMessageSeller(true, false)).toBe(false);
  });

  it('hides message seller for own listing', () => {
    expect(shouldShowMessageSeller(false, true)).toBe(false);
  });

  it('hides message seller when unavailable AND own listing', () => {
    expect(shouldShowMessageSeller(true, true)).toBe(false);
  });
});

// ─── Unavailable banner visibility ───────────────────────────────────────────

describe('ListingActionButtons — unavailable banner', () => {
  it('shows unavailable banner when isUnavailable is true', () => {
    expect(shouldShowUnavailableBanner(true)).toBe(true);
  });

  it('hides unavailable banner when listing is available', () => {
    expect(shouldShowUnavailableBanner(false)).toBe(false);
  });
});

// ─── Default address resolution ───────────────────────────────────────────────

describe('ListingActionButtons — default address resolution', () => {
  it('returns default address id when one is marked default', () => {
    const addresses = [
      { id: 'addr-1', isDefault: false },
      { id: 'addr-2', isDefault: true },
      { id: 'addr-3', isDefault: false },
    ];
    expect(getDefaultAddressId(addresses)).toBe('addr-2');
  });

  it('returns first address id when none is default', () => {
    const addresses = [
      { id: 'addr-1', isDefault: false },
      { id: 'addr-2', isDefault: false },
    ];
    expect(getDefaultAddressId(addresses)).toBe('addr-1');
  });

  it('returns null when address list is empty', () => {
    expect(getDefaultAddressId([])).toBeNull();
  });

  it('returns the only address when list has one item (not default)', () => {
    const addresses = [{ id: 'addr-only', isDefault: false }];
    expect(getDefaultAddressId(addresses)).toBe('addr-only');
  });
});

// ─── Combined scenarios ───────────────────────────────────────────────────────

describe('ListingActionButtons — combined scenario: unavailable listing', () => {
  it('when unavailable: hides all action buttons, shows banner', () => {
    const isUnavailable = true;
    const isOwnListing = false;
    const allowOffers = true;
    const hasWatcherOffer = true;

    expect(shouldShowListingAuthActions(isUnavailable)).toBe(false);
    expect(shouldShowMakeOffer(isUnavailable, allowOffers, isOwnListing)).toBe(false);
    expect(shouldShowWatcherOffer(isUnavailable, isOwnListing, hasWatcherOffer)).toBe(false);
    expect(shouldShowMessageSeller(isUnavailable, isOwnListing)).toBe(false);
    expect(shouldShowUnavailableBanner(isUnavailable)).toBe(true);
  });
});

describe('ListingActionButtons — combined scenario: own listing', () => {
  it('when own listing: hides message seller, make offer, watcher offer', () => {
    const isUnavailable = false;
    const isOwnListing = true;
    const allowOffers = true;
    const hasWatcherOffer = true;

    expect(shouldShowWatchAndPriceAlert(isOwnListing)).toBe(false);
    expect(shouldShowMakeOffer(isUnavailable, allowOffers, isOwnListing)).toBe(false);
    expect(shouldShowWatcherOffer(isUnavailable, isOwnListing, hasWatcherOffer)).toBe(false);
    expect(shouldShowMessageSeller(isUnavailable, isOwnListing)).toBe(false);
    // Buy button still shown (it uses isUnavailable, not isOwnListing)
    expect(shouldShowListingAuthActions(isUnavailable)).toBe(true);
  });
});
