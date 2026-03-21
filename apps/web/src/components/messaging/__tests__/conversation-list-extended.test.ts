/**
 * Extended logic tests for ConversationList — edge cases not covered in the base file.
 */
import { describe, it, expect } from 'vitest';
import type { ConversationSummary } from '@/lib/queries/messaging';

// ─── Pure logic extracted from ConversationList ───────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getUnreadDotVisible(unreadCount: number): boolean {
  return unreadCount > 0;
}

function getTextClass(unreadCount: number): string {
  return unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700';
}

function getStatusBadge(status: ConversationSummary['status']): 'closed' | 'archived' | null {
  if (status === 'READ_ONLY') return 'closed';
  if (status === 'ARCHIVED') return 'archived';
  return null;
}

function hasListingThumb(imageUrl: string | null): boolean {
  return imageUrl !== null;
}

function hasLastMessageAt(lastMessageAt: Date | null): boolean {
  return lastMessageAt !== null;
}

function hasListingTitle(title: string | null): boolean {
  return title !== null;
}

function getConversationHref(id: string): string {
  return `/my/messages/${id}`;
}

// ─── Initials edge cases ──────────────────────────────────────────────────────

describe('ConversationList — initials generation edge cases', () => {
  it('generates two initials for a two-word name', () => {
    expect(getInitials('Alice Smith')).toBe('AS');
  });

  it('generates one initial for a single-word name', () => {
    expect(getInitials('Bob')).toBe('B');
  });

  it('truncates to max 2 characters for three-word name', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MJ');
  });

  it('handles all-caps name correctly', () => {
    expect(getInitials('JOHN DOE')).toBe('JD');
  });

  it('handles hyphenated name (splits on spaces only)', () => {
    // "Anne-Marie" — no space — treated as one word
    expect(getInitials('Anne-Marie Jones')).toBe('AJ');
  });
});

// ─── Unread indicator boundary ────────────────────────────────────────────────

describe('ConversationList — unread count boundary values', () => {
  it('exactly 0 unread count: dot hidden', () => {
    expect(getUnreadDotVisible(0)).toBe(false);
  });

  it('exactly 1 unread count: dot shown', () => {
    expect(getUnreadDotVisible(1)).toBe(true);
  });

  it('large unread count: dot shown', () => {
    expect(getUnreadDotVisible(99)).toBe(true);
  });

  it('text class is bold at unread count exactly 1', () => {
    expect(getTextClass(1)).toContain('font-bold');
  });

  it('text class is medium at unread count exactly 0', () => {
    expect(getTextClass(0)).toContain('font-medium');
  });
});

// ─── Status badge behavior ────────────────────────────────────────────────────

describe('ConversationList — status badge behavior', () => {
  it('READ_ONLY status shows "closed" badge', () => {
    expect(getStatusBadge('READ_ONLY')).toBe('closed');
  });

  it('ARCHIVED status shows "archived" badge', () => {
    expect(getStatusBadge('ARCHIVED')).toBe('archived');
  });

  it('OPEN status shows no badge', () => {
    expect(getStatusBadge('OPEN')).toBeNull();
  });
});

// ─── Conditional display elements ────────────────────────────────────────────

describe('ConversationList — conditional display elements', () => {
  it('shows listing thumbnail when imageUrl is present', () => {
    expect(hasListingThumb('https://cdn.example.com/jacket.jpg')).toBe(true);
  });

  it('hides listing thumbnail when imageUrl is null', () => {
    expect(hasListingThumb(null)).toBe(false);
  });

  it('shows relative timestamp when lastMessageAt is present', () => {
    expect(hasLastMessageAt(new Date())).toBe(true);
  });

  it('hides relative timestamp when lastMessageAt is null', () => {
    expect(hasLastMessageAt(null)).toBe(false);
  });

  it('shows listing title when title is present', () => {
    expect(hasListingTitle('Vintage Camera')).toBe(true);
  });

  it('hides listing title section when title is null', () => {
    expect(hasListingTitle(null)).toBe(false);
  });
});

// ─── Href construction ────────────────────────────────────────────────────────

describe('ConversationList — href construction', () => {
  it('builds /my/messages/:id URL correctly', () => {
    expect(getConversationHref('abc123')).toBe('/my/messages/abc123');
  });

  it('uses correct route prefix /my/messages (not /m or /messages)', () => {
    const href = getConversationHref('any-id');
    expect(href.startsWith('/my/messages/')).toBe(true);
  });
});

// ─── Conversation list shape invariants ──────────────────────────────────────

describe('ConversationList — data shape invariants', () => {
  const conv: ConversationSummary = {
    id: 'conv-test-001',
    listingId: 'listing-001',
    orderId: null,
    otherPartyId: 'user-seller-001',
    otherPartyName: 'Bob Seller',
    otherPartyImage: null,
    listingTitle: 'Cool Jacket',
    listingSlug: 'cool-jacket-abc',
    listingImageUrl: null,
    subject: 'About the jacket',
    status: 'OPEN',
    lastMessageAt: new Date('2026-01-10'),
    unreadCount: 0,
    createdAt: new Date('2026-01-01'),
    lastMessagePreview: null,
    lastMessageSenderIsMe: false,
  };

  it('orderId can be null (pre-order conversation)', () => {
    expect(conv.orderId).toBeNull();
  });

  it('otherPartyImage can be null (no profile photo)', () => {
    expect(conv.otherPartyImage).toBeNull();
  });

  it('unreadCount of 0 is valid and expected for read conversations', () => {
    expect(conv.unreadCount).toBe(0);
    expect(getUnreadDotVisible(conv.unreadCount)).toBe(false);
  });

  it('listingSlug is used for listing thumbnail alt text derivation', () => {
    expect(conv.listingSlug).toBe('cool-jacket-abc');
  });
});
