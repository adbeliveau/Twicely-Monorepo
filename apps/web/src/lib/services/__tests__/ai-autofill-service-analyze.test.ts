/**
 * Tests for analyzeListingImages in ai-autofill-service.ts (G1.1)
 * Does NOT use vi.resetModules() — Anthropic SDK class mock requires stable registry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));
vi.mock('@/lib/queries/ai-autofill', () => ({ getAutofillUsage: vi.fn(), getUserStoreTier: vi.fn() }));
vi.mock('@twicely/db', () => ({ db: { insert: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  aiAutofillUsage: { userId: 'user_id', monthKey: 'month_key', count: 'count' },
}));
vi.mock('drizzle-orm', () => ({
  sql: vi.fn((parts: TemplateStringsArray) => ({ raw: parts[0] })),
  eq: vi.fn((a, b) => ({ a, b })),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { analyzeListingImages } from '../ai-autofill-service';

const VALID_CLAUDE_RESPONSE = JSON.stringify({
  title: 'Nike Air Jordan 1 Retro High',
  description: 'Classic high-top basketball shoe in great condition.',
  category: "Men's Shoes",
  brand: 'Nike',
  condition: 'VERY_GOOD',
  color: 'Red',
  tags: ['nike', 'jordan', 'shoes', 'basketball', 'sneakers'],
  suggestedPriceMinCents: 8000,
  suggestedPriceMaxCents: 12000,
  confidence: 'HIGH',
});

function makeClaudeResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function makeFetchOk(contentType = 'image/jpeg') {
  return {
    ok: true,
    headers: { get: vi.fn().mockReturnValue(contentType) },
    arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image-data').buffer),
  };
}

function makeFetchFail() {
  return {
    ok: false,
    headers: { get: vi.fn().mockReturnValue(null) },
  };
}

describe('analyzeListingImages — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
    mockCreate.mockResolvedValue(makeClaudeResponse(VALID_CLAUDE_RESPONSE));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns structured suggestions from a valid Claude response', async () => {
    const result = await analyzeListingImages(['https://cdn.twicely.com/img1.jpg']);

    expect(result.title).toBe('Nike Air Jordan 1 Retro High');
    expect(result.brand).toBe('Nike');
    expect(result.condition).toBe('VERY_GOOD');
    expect(result.suggestedPriceMinCents).toBe(8000);
    expect(result.suggestedPriceMaxCents).toBe(12000);
    expect(result.confidence).toBe('HIGH');
    expect(result.tags).toEqual(['nike', 'jordan', 'shoes', 'basketball', 'sneakers']);
  });

  it('only sends first 4 images when 8 URLs are provided', async () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://cdn.twicely.com/img${i + 1}.jpg`);

    await analyzeListingImages(urls);

    const mockFetch = vi.mocked(global.fetch);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('sends exactly 4 images when exactly 4 URLs provided', async () => {
    const urls = Array.from({ length: 4 }, (_, i) => `https://cdn.twicely.com/img${i + 1}.jpg`);

    await analyzeListingImages(urls);

    const mockFetch = vi.mocked(global.fetch);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('uses model from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'ai.autofill.model') return Promise.resolve('claude-opus-4');
      return Promise.resolve(fallback);
    });

    await analyzeListingImages(['https://cdn.twicely.com/img1.jpg']);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4' })
    );
  });

  it('resolves relative URLs using NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://twicely.co';

    await analyzeListingImages(['/uploads/img1.jpg']);

    const mockFetch = vi.mocked(global.fetch);
    expect(mockFetch).toHaveBeenCalledWith('https://twicely.co/uploads/img1.jpg');

    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

describe('analyzeListingImages — partial response with defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fills in defaults for missing fields', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify({ title: 'Vintage Lamp', confidence: 'LOW' }))
    );

    const result = await analyzeListingImages(['https://cdn.twicely.com/img1.jpg']);

    expect(result.title).toBe('Vintage Lamp');
    expect(result.description).toBe('');
    expect(result.brand).toBe('');
    expect(result.condition).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.suggestedPriceMinCents).toBe(0);
    expect(result.confidence).toBe('LOW');
  });
});

describe('analyzeListingImages — error cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws PARSE_FAILED when Claude returns non-JSON text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
    mockCreate.mockResolvedValue(makeClaudeResponse('I am a helpful assistant!'));

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'PARSE_FAILED'
    );
  });

  it('throws PARSE_FAILED when Claude response has no text block', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
    mockCreate.mockResolvedValue({ content: [{ type: 'tool_use', id: 'abc' }] });

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'PARSE_FAILED'
    );
  });

  it('throws PARSE_FAILED when Claude response has empty content array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
    mockCreate.mockResolvedValue({ content: [] });

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'PARSE_FAILED'
    );
  });

  it('throws NO_IMAGES when all image fetches return non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchFail()));

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'NO_IMAGES'
    );
  });

  it('throws NO_IMAGES when fetch throws an exception for all images', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'NO_IMAGES'
    );
  });

  it('still succeeds when one of two images fails to fetch', async () => {
    mockCreate.mockResolvedValue(makeClaudeResponse(VALID_CLAUDE_RESPONSE));
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(makeFetchFail())
        .mockResolvedValueOnce(makeFetchOk())
    );

    const result = await analyzeListingImages([
      'https://cdn.twicely.com/img1.jpg',
      'https://cdn.twicely.com/img2.jpg',
    ]);

    expect(result.title).toBe('Nike Air Jordan 1 Retro High');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('propagates Anthropic SDK errors as thrown exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchOk()));
    mockCreate.mockRejectedValue(new Error('anthropic_rate_limit'));

    await expect(analyzeListingImages(['https://cdn.twicely.com/img1.jpg'])).rejects.toThrow(
      'anthropic_rate_limit'
    );
  });
});
