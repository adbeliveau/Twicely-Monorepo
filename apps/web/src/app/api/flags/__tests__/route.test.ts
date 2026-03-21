/**
 * Tests for GET /api/flags (G10.5)
 * Verifies flag evaluation, auth handling, cache headers, and data hygiene.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
vi.mock('@twicely/auth/server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

const mockIsFeatureEnabled = vi.fn();
vi.mock('@/lib/services/feature-flags', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema/platform', () => ({
  featureFlag: { key: 'key' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

// ─── Request factory ─────────────────────────────────────────────────────────

function makeRequest(keys?: string): Request {
  const url = keys
    ? `http://localhost/api/flags?keys=${encodeURIComponent(keys)}`
    : 'http://localhost/api/flags';
  return new Request(url);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetSession.mockResolvedValue(null);
  });

  it('returns 400 when no keys param provided (M4 security: prevent flag name enumeration)', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('keys parameter is required');
  });

  it('returns only specified flags when keys param provided', async () => {
    mockIsFeatureEnabled
      .mockResolvedValueOnce(true)  // kill.checkout
      .mockResolvedValueOnce(false); // gate.marketplace

    const { GET } = await import('../route');
    const res = await GET(makeRequest('kill.checkout,gate.marketplace'));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(body.flags).toHaveProperty('kill.checkout', true);
    expect(body.flags).toHaveProperty('gate.marketplace', false);
    // DB should NOT be called for the all-keys fetch since keys were provided
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns 400 when no keys param and no flags in DB (security: keys required)', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it('evaluates BOOLEAN flags correctly — enabled vs disabled', async () => {
    mockIsFeatureEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('feature.on,feature.off'));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(body.flags['feature.on']).toBe(true);
    expect(body.flags['feature.off']).toBe(false);
  });

  it('evaluates PERCENTAGE flags with authenticated user — passes userId', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-abc' } });
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { GET } = await import('../route');
    await GET(makeRequest('feature.pct'));

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      'feature.pct',
      { userId: 'user-abc' }
    );
  });

  it('returns false for PERCENTAGE flags without authentication — no userId passed', async () => {
    mockGetSession.mockResolvedValue(null);
    // isFeatureEnabled is called with userId: undefined — the engine returns false
    mockIsFeatureEnabled.mockResolvedValue(false);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('feature.pct'));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      'feature.pct',
      { userId: undefined }
    );
    expect(body.flags['feature.pct']).toBe(false);
  });

  it('evaluates TARGETED flags with user override', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-targeted' } });
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('feature.targeted'));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      'feature.targeted',
      { userId: 'user-targeted' }
    );
    expect(body.flags['feature.targeted']).toBe(true);
  });

  it('defaults to false for unknown flag keys in keys param', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('no.such.flag'));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(body.flags['no.such.flag']).toBe(false);
  });

  it('handles Valkey/DB errors gracefully — returns false defaults', async () => {
    mockIsFeatureEnabled.mockRejectedValue(new Error('DB connection failed'));

    const { GET } = await import('../route');
    const res = await GET(makeRequest('kill.checkout'));
    const body = await res.json() as { flags: Record<string, boolean> };

    // Should not throw, should return false
    expect(res.status).toBe(200);
    expect(body.flags['kill.checkout']).toBe(false);
  });

  it('sets Cache-Control: private, max-age=30 header', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('feature.test'));

    expect(res.headers.get('cache-control')).toBe('private, max-age=30');
  });

  it('does not expose raw flag metadata — response only has flags key', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { GET } = await import('../route');
    const res = await GET(makeRequest('feature.test'));
    const body = await res.json() as Record<string, unknown>;

    // Only 'flags' key allowed in the response body
    expect(Object.keys(body)).toEqual(['flags']);
    // Each value in flags must be a boolean
    for (const val of Object.values(body.flags as Record<string, unknown>)) {
      expect(typeof val).toBe('boolean');
    }
  });

  it('handles malformed keys param gracefully — trims whitespace and filters empty', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { GET } = await import('../route');
    // keys with extra whitespace and empty segments
    const res = await GET(makeRequest(' feature.a , , feature.b '));
    const body = await res.json() as { flags: Record<string, boolean> };

    expect(body.flags).toHaveProperty('feature.a');
    expect(body.flags).toHaveProperty('feature.b');
    expect(Object.keys(body.flags)).toHaveLength(2);
  });
});
