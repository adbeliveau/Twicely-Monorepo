/**
 * Admin Search Query Tests (I11)
 * Covers getTypesenseCollections connection status and graceful degradation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetInfraConfig = vi.fn();
vi.mock('@twicely/config/infra-config', () => ({
  getInfraConfig: (...args: unknown[]) => mockGetInfraConfig(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockConfigured(url = 'http://localhost:8108', apiKey = 'test-key') {
  mockGetInfraConfig.mockReturnValue({
    typesenseUrl: url,
    typesenseApiKey: apiKey,
    valkeyHost: '127.0.0.1',
    valkeyPort: 6379,
    centrifugoApiUrl: '',
    centrifugoApiKey: '',
  });
}

function mockNotConfigured() {
  mockGetInfraConfig.mockReturnValue({
    typesenseUrl: '',
    typesenseApiKey: '',
    valkeyHost: '127.0.0.1',
    valkeyPort: 6379,
    centrifugoApiUrl: '',
    centrifugoApiKey: '',
  });
}

// ─── getTypesenseCollections ──────────────────────────────────────────────────

describe('getTypesenseCollections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns not-configured when URL is empty', async () => {
    mockNotConfigured();
    const { getTypesenseCollections } = await import('../admin-search');

    const result = await getTypesenseCollections();

    expect(result.connected).toBe(false);
    expect(result.latencyMs).toBeNull();
    expect(result.collections).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });

  it('returns collections on successful fetch', async () => {
    mockConfigured();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'listings', num_documents: 1200 },
        { name: 'users', num_documents: 500 },
      ],
    });
    const { getTypesenseCollections } = await import('../admin-search');

    const result = await getTypesenseCollections();

    expect(result.connected).toBe(true);
    expect(result.collections).toHaveLength(2);
    expect(result.collections[0]?.name).toBe('listings');
    expect(result.collections[0]?.numDocuments).toBe(1200);
  });

  it('handles non-OK response gracefully', async () => {
    mockConfigured();
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const { getTypesenseCollections } = await import('../admin-search');

    const result = await getTypesenseCollections();

    expect(result.connected).toBe(false);
    expect(result.error).toContain('401');
  });

  it('handles network error gracefully', async () => {
    mockConfigured();
    mockFetch.mockRejectedValue(new Error('Connection refused'));
    const { getTypesenseCollections } = await import('../admin-search');

    const result = await getTypesenseCollections();

    expect(result.connected).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('includes latencyMs when configured', async () => {
    mockConfigured();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    const { getTypesenseCollections } = await import('../admin-search');

    const result = await getTypesenseCollections();

    expect(result.connected).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
  });
});
