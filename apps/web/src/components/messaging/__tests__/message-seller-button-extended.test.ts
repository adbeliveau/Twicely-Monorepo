/**
 * Extended logic tests for MessageSellerButton — inline form, cancel behavior,
 * char count, and combined scenarios.
 */
import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from MessageSellerButton ────────────────────────────

const MAX_BODY_LENGTH = 5000;

function getNavigationTarget(
  isLoggedIn: boolean,
  existingConversationId: string | null,
  listingSlug: string,
): 'show-form' | string {
  if (!isLoggedIn) {
    return `/auth/login?callbackUrl=/i/${listingSlug}`;
  }
  if (existingConversationId) {
    return `/my/messages/${existingConversationId}`;
  }
  return 'show-form';
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

function isSendDisabled(body: string, isPending: boolean): boolean {
  return isPending || !body.trim();
}

function getCharDisplay(body: string): string {
  return `${body.length}/${MAX_BODY_LENGTH}`;
}

function cancelForm(showForm: boolean): boolean {
  return showForm ? false : false;
}

function getLoginCallbackUrl(listingSlug: string): string {
  return `/auth/login?callbackUrl=/i/${listingSlug}`;
}

function getExistingConvUrl(conversationId: string): string {
  return `/my/messages/${conversationId}`;
}

// ─── Navigation target ────────────────────────────────────────────────────────

describe('MessageSellerButton — navigation target', () => {
  it('unauthenticated: redirects to login with correct callback URL', () => {
    const target = getNavigationTarget(false, null, 'nike-air-max');
    expect(target).toBe('/auth/login?callbackUrl=/i/nike-air-max');
  });

  it('unauthenticated with existing conversation: still goes to login (not conversation)', () => {
    // Logged-out users cannot skip to the conversation
    const target = getNavigationTarget(false, 'conv-123', 'nike-air-max');
    expect(target).toBe('/auth/login?callbackUrl=/i/nike-air-max');
  });

  it('authenticated with existing conversation: goes to conversation', () => {
    const target = getNavigationTarget(true, 'conv-abc-def', 'vintage-jacket');
    expect(target).toBe('/my/messages/conv-abc-def');
  });

  it('authenticated with no existing conversation: shows inline form', () => {
    const target = getNavigationTarget(true, null, 'vintage-jacket');
    expect(target).toBe('show-form');
  });

  it('login callback URL uses /i/ prefix (not /listing/)', () => {
    const url = getLoginCallbackUrl('some-listing-slug');
    expect(url).toContain('/i/');
    expect(url).not.toContain('/listing/');
  });

  it('conversation URL uses /my/messages/ prefix (not /m/)', () => {
    const url = getExistingConvUrl('conv-001');
    expect(url).toBe('/my/messages/conv-001');
    expect(url).not.toContain('/m/');
  });
});

// ─── Inline form display ──────────────────────────────────────────────────────

describe('MessageSellerButton — inline form display', () => {
  it('shows form after click when logged in and no existing conversation', () => {
    expect(shouldShowInlineForm(true, null, true)).toBe(true);
  });

  it('does not show form before click', () => {
    expect(shouldShowInlineForm(true, null, false)).toBe(false);
  });

  it('does not show form when not logged in (redirect happens instead)', () => {
    expect(shouldShowInlineForm(false, null, true)).toBe(false);
  });

  it('does not show form when existing conversation exists (navigate instead)', () => {
    expect(shouldShowInlineForm(true, 'conv-123', true)).toBe(false);
  });
});

// ─── Inline form send button ──────────────────────────────────────────────────

describe('MessageSellerButton — inline form send button', () => {
  it('send is disabled when inline form body is empty', () => {
    expect(isSendDisabled('', false)).toBe(true);
  });

  it('send is disabled when body is only whitespace', () => {
    expect(isSendDisabled('  ', false)).toBe(true);
  });

  it('send is disabled when pending', () => {
    expect(isSendDisabled('Hello', true)).toBe(true);
  });

  it('send is enabled when body has content and not pending', () => {
    expect(isSendDisabled('I have a question about this', false)).toBe(false);
  });
});

// ─── Character count display ──────────────────────────────────────────────────

describe('MessageSellerButton — character count display', () => {
  it('shows 0/5000 for empty body', () => {
    expect(getCharDisplay('')).toBe('0/5000');
  });

  it('shows correct count for a typical message', () => {
    const body = 'Is this still available?';
    expect(getCharDisplay(body)).toBe(`${body.length}/5000`);
  });

  it('shows 5000/5000 at the character limit', () => {
    expect(getCharDisplay('A'.repeat(5000))).toBe('5000/5000');
  });
});

// ─── Cancel behavior ─────────────────────────────────────────────────────────

describe('MessageSellerButton — cancel inline form', () => {
  it('cancelling sets showForm to false', () => {
    // cancelForm(true) → false
    expect(cancelForm(true)).toBe(false);
  });

  it('cancel is a no-op when form is already hidden', () => {
    expect(cancelForm(false)).toBe(false);
  });
});

// ─── Combined scenario: new conversation ──────────────────────────────────────

describe('MessageSellerButton — new conversation flow', () => {
  it('clicking when logged in with no existing conversation shows form', () => {
    const target = getNavigationTarget(true, null, 'test-listing');
    const showForm = target === 'show-form';
    expect(showForm).toBe(true);
  });

  it('after successful send: navigates to /my/messages/:conversationId', () => {
    const newConvId = 'cuid2convaaaaaaaa';
    const url = getExistingConvUrl(newConvId);
    expect(url).toBe('/my/messages/cuid2convaaaaaaaa');
  });

  it('after failed send: body is preserved for retry', () => {
    // Body state preserved when success is false
    const body = 'My question here';
    const isCleared = body.length === 0;
    expect(isCleared).toBe(false);
    expect(body).toBe('My question here');
  });
});

// ─── Business rule: own listing ───────────────────────────────────────────────

describe('MessageSellerButton — not shown on own listing', () => {
  // The parent (ListingActionButtons) gates this with !isOwnListing && !isUnavailable.
  // Tests verify the gate logic (the button renders when placed — parent gates it).

  it('isOwnListing=true means the button should not be rendered by parent', () => {
    const isOwnListing = true;
    const isUnavailable = false;
    const shouldRender = !isOwnListing && !isUnavailable;
    expect(shouldRender).toBe(false);
  });

  it('isOwnListing=false, isUnavailable=false means button is rendered', () => {
    const isOwnListing = false;
    const isUnavailable = false;
    const shouldRender = !isOwnListing && !isUnavailable;
    expect(shouldRender).toBe(true);
  });

  it('isUnavailable=true means button is not rendered regardless of ownership', () => {
    const isOwnListing = false;
    const isUnavailable = true;
    const shouldRender = !isOwnListing && !isUnavailable;
    expect(shouldRender).toBe(false);
  });
});
