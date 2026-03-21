/**
 * Tests for messaging-admin.ts — getFlaggedConversations query
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockSelect = db.select as Mock;

// ─── Chain Helper ──────────────────────────────────────────────────────────────

/**
 * getFlaggedConversations: select().from().where().orderBy().limit()
 */
function makeChain(rows: unknown[]) {
  const chainable: Record<string, Mock> = {};
  const methods = ['from', 'where', 'orderBy', 'limit'];
  for (const m of methods) {
    chainable[m] = vi.fn().mockImplementation(() => chainable);
  }
  (chainable.limit as Mock).mockResolvedValue(rows);
  return chainable;
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-20T10:00:00Z');

const flaggedRow = {
  id: 'conv-flagged-001',
  subject: 'Vintage Camera',
  flagReason: 'Off-platform transaction detected',
  lastMessageAt: NOW,
  buyerName: 'Alice Buyer',
  sellerName: 'Bob Seller',
};

// ─── getFlaggedConversations ──────────────────────────────────────────────────

describe('getFlaggedConversations — happy path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped FlaggedConversationRow array for flagged conversations', async () => {
    mockSelect.mockReturnValueOnce(makeChain([flaggedRow]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('conv-flagged-001');
    expect(result[0]?.subject).toBe('Vintage Camera');
    expect(result[0]?.flagReason).toBe('Off-platform transaction detected');
    expect(result[0]?.buyerName).toBe('Alice Buyer');
    expect(result[0]?.sellerName).toBe('Bob Seller');
    expect(result[0]?.lastMessageAt).toEqual(NOW);
  });

  it('returns empty array when no flagged conversations exist', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result).toEqual([]);
  });

  it('returns multiple flagged conversations', async () => {
    const rows = [
      { ...flaggedRow, id: 'conv-001', buyerName: 'Alice', sellerName: 'Bob' },
      { ...flaggedRow, id: 'conv-002', buyerName: 'Carol', sellerName: 'Dave' },
      { ...flaggedRow, id: 'conv-003', buyerName: 'Eve', sellerName: 'Frank' },
    ];
    mockSelect.mockReturnValueOnce(makeChain(rows) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('conv-001');
    expect(result[2]?.id).toBe('conv-003');
  });
});

describe('getFlaggedConversations — null / fallback handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('falls back to "Unknown" when buyerName is null', async () => {
    const row = { ...flaggedRow, buyerName: null };
    mockSelect.mockReturnValueOnce(makeChain([row]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result[0]?.buyerName).toBe('Unknown');
  });

  it('falls back to "Unknown" when sellerName is null', async () => {
    const row = { ...flaggedRow, sellerName: null };
    mockSelect.mockReturnValueOnce(makeChain([row]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result[0]?.sellerName).toBe('Unknown');
  });

  it('returns null subject when conversation has no subject', async () => {
    const row = { ...flaggedRow, subject: null };
    mockSelect.mockReturnValueOnce(makeChain([row]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result[0]?.subject).toBeNull();
  });

  it('returns null flagReason when flagReason is null', async () => {
    const row = { ...flaggedRow, flagReason: null };
    mockSelect.mockReturnValueOnce(makeChain([row]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result[0]?.flagReason).toBeNull();
  });

  it('returns null lastMessageAt when lastMessageAt is null', async () => {
    const row = { ...flaggedRow, lastMessageAt: null };
    mockSelect.mockReturnValueOnce(makeChain([row]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();

    expect(result[0]?.lastMessageAt).toBeNull();
  });
});

describe('getFlaggedConversations — query structure', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes exactly 1 db.select() call', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    await getFlaggedConversations();

    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('preserves all fields from the returned row', async () => {
    mockSelect.mockReturnValueOnce(makeChain([flaggedRow]) as never);

    const { getFlaggedConversations } = await import('../messaging-admin');
    const result = await getFlaggedConversations();
    const row = result[0];

    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('subject');
    expect(row).toHaveProperty('buyerName');
    expect(row).toHaveProperty('sellerName');
    expect(row).toHaveProperty('flagReason');
    expect(row).toHaveProperty('lastMessageAt');
  });
});
