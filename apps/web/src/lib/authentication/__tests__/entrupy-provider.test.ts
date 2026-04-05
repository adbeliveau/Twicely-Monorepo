import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetPlatformSetting = vi.fn();

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const MOCK_API_URL = 'https://api.entrupy.com/v1';
const MOCK_SECRET = 'test-webhook-secret-1234';

// ─── Helper to compute valid HMAC ───────────────────────────────────────────

function computeHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EntrupyProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'trust.authentication.aiProviderApiUrl') return Promise.resolve(MOCK_API_URL);
      return Promise.resolve(null);
    });
    vi.stubGlobal('fetch', vi.fn());
    process.env['AI_PROVIDER_WEBHOOK_SECRET'] = MOCK_SECRET;
  });

  it('submitForAuthentication POSTs to {apiUrl}/authentications', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'entrupy-ref-abc' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    await provider.submitForAuthentication({
      requestId: 'req-1',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
      category: 'HANDBAGS',
      itemTitle: 'Luxury Bag',
      itemPriceCents: 60000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${MOCK_API_URL}/authentications`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('submitForAuthentication includes photoUrls and category in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'entrupy-ref-abc' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    const photoUrls = ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'];
    await provider.submitForAuthentication({
      requestId: 'req-2',
      photoUrls,
      category: 'SNEAKERS',
      itemTitle: 'Rare Sneakers',
      itemPriceCents: 30000,
    });

    const callArgs = mockFetch.mock.calls[0];
    const callBody = JSON.parse((callArgs?.[1] as RequestInit)?.body as string) as Record<string, unknown>;
    expect(callBody['image_urls']).toEqual(photoUrls);
    expect(callBody['category']).toBe('SNEAKERS');
  });

  it('submitForAuthentication returns providerRef from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'entrupy-ref-xyz' }),
    }));

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    const { providerRef } = await provider.submitForAuthentication({
      requestId: 'req-3',
      photoUrls: ['https://r2.example.com/a.jpg', 'https://r2.example.com/b.jpg', 'https://r2.example.com/c.jpg'],
      category: 'WATCHES',
      itemTitle: 'Watch',
      itemPriceCents: 80000,
    });

    expect(providerRef).toBe('entrupy-ref-xyz');
  });

  it('getResult fetches from {apiUrl}/authentications/{providerRef}', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ref-1', status: 'authentic', confidence: 0.98 }),
    }));

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    await provider.getResult('ref-1');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(`${MOCK_API_URL}/authentications/ref-1`);
  });

  it('verifyWebhookSignature returns true for valid HMAC', async () => {
    const payload = JSON.stringify({ id: 'ref-1', status: 'authentic' });
    const signature = computeHmac(payload, MOCK_SECRET);

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    expect(provider.verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it('verifyWebhookSignature returns false for invalid HMAC', async () => {
    const payload = JSON.stringify({ id: 'ref-1', status: 'authentic' });

    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    expect(provider.verifyWebhookSignature(payload, 'invalid-signature')).toBe(false);
  });

  it('verifyWebhookSignature returns false for empty signature', async () => {
    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    expect(provider.verifyWebhookSignature('{"id":"ref-1"}', '')).toBe(false);
  });

  it('parseWebhookResult maps authentic → AUTHENTICATED', async () => {
    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    const result = provider.parseWebhookResult(
      JSON.stringify({ id: 'ref-1', status: 'authentic', confidence: 0.99 })
    );
    expect(result.status).toBe('AUTHENTICATED');
    expect(result.providerRef).toBe('ref-1');
  });

  it('parseWebhookResult maps inconclusive → INCONCLUSIVE', async () => {
    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    const result = provider.parseWebhookResult(
      JSON.stringify({ id: 'ref-2', status: 'inconclusive', confidence: 0.4 })
    );
    expect(result.status).toBe('INCONCLUSIVE');
  });

  it('parseWebhookResult maps fake → COUNTERFEIT', async () => {
    const { EntrupyProvider } = await import('../entrupy-provider');
    const provider = new EntrupyProvider();
    const result = provider.parseWebhookResult(
      JSON.stringify({ id: 'ref-3', status: 'fake', confidence: 0.95 })
    );
    expect(result.status).toBe('COUNTERFEIT');
  });
});
