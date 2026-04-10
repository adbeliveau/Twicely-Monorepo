/**
 * Tests for messaging-safety/keyword-filter.ts
 * V4-15: Messaging Safety & Abuse Prevention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
};
Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));

const mockDb = {
  insert: vi.fn().mockReturnValue(mockChain),
  select: vi.fn().mockReturnValue(mockChain),
  update: vi.fn().mockReturnValue(mockChain),
};

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  bannedKeyword: {
    isActive: 'is_active',
    keyword: 'keyword',
    isRegex: 'is_regex',
    action: 'action',
    id: 'id',
  },
}));

const mockGetPlatformSetting = vi.fn();
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('filterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, def: unknown) => def);
    // Default: no DB keywords
    mockChain.where.mockResolvedValue([]);
  });

  it('returns allow for a clean message', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Is this item still available?');

    expect(result.action).toBe('allow');
    expect(result.matchedKeywords).toHaveLength(0);
  });

  it('flags an email address via built-in pattern', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Email me at user@example.com');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('flags a phone number via built-in pattern', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Call me at 555-123-4567');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('flags a URL via built-in pattern', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Check out https://example.com/deal');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords).toContain('https://example.com/deal');
  });

  it('flags social media handles via built-in pattern', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Add me on instagram');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('flags international phone numbers', async () => {
    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('My number is +1-555-123-4567');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('returns block when a DB keyword with block action matches', async () => {
    mockChain.where.mockResolvedValue([
      { id: 'kw-1', keyword: 'scammer', isRegex: false, action: 'block', isActive: true },
    ]);

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('You are a scammer');

    expect(result.action).toBe('block');
    expect(result.matchedKeywords).toContain('scammer');
  });

  it('returns flag when a DB keyword with flag action matches', async () => {
    mockChain.where.mockResolvedValue([
      { id: 'kw-2', keyword: 'suspicious', isRegex: false, action: 'flag', isActive: true },
    ]);

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('This seems suspicious');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords).toContain('suspicious');
  });

  it('handles regex DB keywords', async () => {
    mockChain.where.mockResolvedValue([
      { id: 'kw-3', keyword: '\\b(pills?|drugs?)\\b', isRegex: true, action: 'block', isActive: true },
    ]);

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('I have some pills for sale');

    expect(result.action).toBe('block');
  });

  it('returns allow when keyword filter is disabled', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, def: unknown) => {
      if (key === 'messaging.keywordFilter.enabled') return false;
      return def;
    });

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('user@example.com 555-123-4567');

    expect(result.action).toBe('allow');
  });

  it('block takes priority over flag when multiple keywords match', async () => {
    mockChain.where.mockResolvedValue([
      { id: 'kw-4', keyword: 'flagword', isRegex: false, action: 'flag', isActive: true },
      { id: 'kw-5', keyword: 'blockword', isRegex: false, action: 'block', isActive: true },
    ]);

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('flagword and blockword in message');

    expect(result.action).toBe('block');
    expect(result.matchedKeywords).toContain('flagword');
    expect(result.matchedKeywords).toContain('blockword');
  });

  it('gracefully handles DB errors and still returns contact pattern matches', async () => {
    mockChain.where.mockRejectedValue(new Error('DB connection error'));

    const { filterMessage } = await import('../keyword-filter');
    const result = await filterMessage('Email me at user@example.com');

    expect(result.action).toBe('flag');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });
});

describe('CONTACT_PATTERNS', () => {
  it('exports an array of RegExp patterns', async () => {
    const { CONTACT_PATTERNS } = await import('../keyword-filter');

    expect(Array.isArray(CONTACT_PATTERNS)).toBe(true);
    expect(CONTACT_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of CONTACT_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});
