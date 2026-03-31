/**
 * Tests for centrifugo-publisher.ts
 *
 * Covers:
 * - sellerChannel: returns correct private-user.{sellerId} format
 * - publishToChannel: skips (no-op) when centrifugoApiUrl is not configured
 * - publishToChannel: sends POST to {apiUrl}/api/publish with correct shape
 * - publishToChannel: includes Authorization header when apiKey is set
 * - publishToChannel: omits Authorization header when apiKey is empty
 * - publishToChannel: logs error (does not throw) when fetch fails
 * - publishToChannel: logs error (does not throw) when HTTP response is non-OK
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@twicely/config/infra-config', () => ({
  getInfraConfig: vi.fn(),
}));
vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { getInfraConfig } from '@twicely/config/infra-config';
import { logger } from '@twicely/logger';
import { publishToChannel, sellerChannel } from '../centrifugo-publisher';
import type { Mock } from 'vitest';

const mockGetInfraConfig = getInfraConfig as Mock;
const mockLoggerWarn = (logger.warn as Mock);
const mockLoggerError = (logger.error as Mock);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInfraConfig(overrides: { centrifugoApiUrl?: string; centrifugoApiKey?: string } = {}) {
  return {
    valkeyHost: '127.0.0.1',
    valkeyPort: 6379,
    typesenseUrl: '',
    typesenseApiKey: '',
    centrifugoApiUrl: overrides.centrifugoApiUrl ?? 'http://centrifugo.test:8000',
    centrifugoApiKey: overrides.centrifugoApiKey ?? 'test-api-key',
  };
}

// ─── sellerChannel ────────────────────────────────────────────────────────────

describe('sellerChannel', () => {
  it('returns private-user. prefixed channel name', () => {
    expect(sellerChannel('seller-abc-123')).toBe('private-user.seller-abc-123');
  });

  it('includes the sellerId exactly', () => {
    const id = 'clseller9876xyz';
    expect(sellerChannel(id)).toBe(`private-user.${id}`);
  });

  it('format matches conversationChannel private-user pattern', () => {
    const channel = sellerChannel('any-seller');
    expect(channel).toMatch(/^private-user\./);
  });
});

// ─── publishToChannel ─────────────────────────────────────────────────────────

describe('publishToChannel — no-op when centrifugoApiUrl is not configured', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => vi.unstubAllGlobals());

  it('silently returns without fetching when centrifugoApiUrl is empty', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig({ centrifugoApiUrl: '' }));
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'message' });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('logs a warning when centrifugoApiUrl is not configured', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig({ centrifugoApiUrl: '' }));
    vi.stubGlobal('fetch', vi.fn());

    await publishToChannel('private-conversation.conv-1', { type: 'typing' });

    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    const warnArgs = mockLoggerWarn.mock.calls[0] as [string, Record<string, unknown>];
    expect(warnArgs[0]).toContain('centrifugoApiUrl not configured');
    expect(warnArgs[1]).toMatchObject({ channel: 'private-conversation.conv-1' });
  });
});

describe('publishToChannel — sends correct request when configured', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('calls fetch with POST method to {apiUrl}/api/publish', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig({
      centrifugoApiUrl: 'http://centrifugo.test:8000',
    }));
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'message', userId: 'u-1' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://centrifugo.test:8000/api/publish');
    expect(opts.method).toBe('POST');
  });

  it('request body contains channel and data', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    const channel = 'private-conversation.conv-abc';
    const data = { type: 'typing', userId: 'user-123' };
    await publishToChannel(channel, data);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { channel: string; data: Record<string, unknown> };
    expect(body.channel).toBe(channel);
    expect(body.data).toEqual(data);
  });

  it('includes Authorization header when apiKey is set', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig({ centrifugoApiKey: 'my-api-key' }));
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-user.seller-1', { type: 'message' });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('apikey my-api-key');
  });

  it('omits Authorization header when apiKey is empty string', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig({ centrifugoApiKey: '' }));
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'message' });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sets Content-Type application/json', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'message' });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('publishToChannel — error handling (does not throw)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('does not throw when fetch rejects (network error)', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      publishToChannel('private-conversation.conv-1', { type: 'typing' }),
    ).resolves.toBeUndefined();
  });

  it('logs error when fetch rejects', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'typing' });

    expect(mockLoggerError).toHaveBeenCalledOnce();
    const errorArgs = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>];
    expect(errorArgs[0]).toContain('Network error');
  });

  it('does not throw when HTTP response is non-OK (500)', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      publishToChannel('private-conversation.conv-1', { type: 'message' }),
    ).resolves.toBeUndefined();
  });

  it('logs error when HTTP response is non-OK', async () => {
    mockGetInfraConfig.mockReturnValue(makeInfraConfig());
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });
    vi.stubGlobal('fetch', mockFetch);

    await publishToChannel('private-conversation.conv-1', { type: 'message' });

    expect(mockLoggerError).toHaveBeenCalledOnce();
    const errorArgs = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>];
    expect(errorArgs[0]).toContain('Publish failed');
    expect((errorArgs[1] as { status: number }).status).toBe(503);
  });
});
