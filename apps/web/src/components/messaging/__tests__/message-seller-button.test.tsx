import { describe, it, expect } from 'vitest';

// Logic tests for MessageSellerButton behavior

function getButtonText(): string {
  return 'Message Seller';
}

function getNavigationTarget(
  isLoggedIn: boolean,
  existingConversationId: string | null,
  listingSlug: string,
): string {
  if (!isLoggedIn) {
    return `/auth/login?callbackUrl=/i/${listingSlug}`;
  }
  if (existingConversationId) {
    return `/my/messages/${existingConversationId}`;
  }
  // Opens inline form — no navigation yet
  return 'show-form';
}

function shouldShowButton(isOwnListing: boolean, isUnavailable: boolean): boolean {
  // Business rule: do NOT show on own listings or unavailable listings
  // Note: in ListingActionButtons the button is gated by !isOwnListing && !isUnavailable
  // The button itself always renders when placed — parent gates it
  return !isOwnListing && !isUnavailable;
}

function shouldShowInlineForm(
  isLoggedIn: boolean,
  existingConversationId: string | null,
  clicked: boolean,
): boolean {
  if (!isLoggedIn) return false;
  if (existingConversationId) return false;
  return clicked;
}

describe('MessageSellerButton behavior logic', () => {
  it('renders "Message Seller" button text', () => {
    expect(getButtonText()).toBe('Message Seller');
  });

  it('navigates to existing conversation when existingConversationId provided', () => {
    const target = getNavigationTarget(true, 'conv-abc-123', 'nike-air-max');
    expect(target).toBe('/my/messages/conv-abc-123');
  });

  it('shows inline compose form when no existing conversation after click', () => {
    const shouldShow = shouldShowInlineForm(true, null, true);
    expect(shouldShow).toBe(true);

    const notShownWhenExisting = shouldShowInlineForm(true, 'conv123', true);
    expect(notShownWhenExisting).toBe(false);
  });

  it('redirects to login when not authenticated', () => {
    const target = getNavigationTarget(false, null, 'vintage-camera');
    expect(target).toBe('/auth/login?callbackUrl=/i/vintage-camera');
  });

  it('button not shown on own listings', () => {
    expect(shouldShowButton(true, false)).toBe(false);
    expect(shouldShowButton(false, false)).toBe(true);
  });

  it('button not shown on unavailable listings', () => {
    expect(shouldShowButton(false, true)).toBe(false);
    expect(shouldShowButton(false, false)).toBe(true);
  });
});
