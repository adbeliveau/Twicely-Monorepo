/**
 * Tests for QuickBooks adapter — G10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPlatformSetting = vi.fn();

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

// Provide default platform settings for QB
function setupDefaultSettings() {
  mockGetPlatformSetting.mockImplementation((key: string, defaultValue: unknown) => {
    const settings: Record<string, unknown> = {
      'accounting.quickbooks.authUrl': 'https://appcenter.intuit.com/connect/oauth2',
      'accounting.quickbooks.clientId': 'test-client-id',
      'accounting.quickbooks.scopes': 'com.intuit.quickbooks.accounting',
      'accounting.quickbooks.tokenUrl': 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      'accounting.quickbooks.clientSecret': 'test-client-secret',
      'accounting.quickbooks.apiUrl': 'https://quickbooks.api.intuit.com',
    };
    return settings[key] ?? defaultValue;
  });
}

describe('QuickBooksAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultSettings();
  });

  describe('getAuthorizationUrl', () => {
    it('includes clientId, scopes, and state in URL', async () => {
      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const url = await adapter.getAuthorizationUrl('my-state-123', 'https://example.com/callback');

      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=my-state-123');
      expect(url).toContain('com.intuit.quickbooks.accounting');
      expect(url).toContain('redirect_uri=');
    });

    it('uses base URL from platform setting', async () => {
      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const url = await adapter.getAuthorizationUrl('state', 'https://example.com/cb');
      expect(url).toContain('appcenter.intuit.com');
    });
  });

  describe('exchangeCode', () => {
    it('POSTs to tokenUrl and returns tokens with realmId', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'access-abc',
          refresh_token: 'refresh-xyz',
          expires_in: 3600,
          realmId: 'realm-001',
        }),
        text: vi.fn().mockResolvedValue(''),
      });
      vi.stubGlobal('fetch', fetchMock);

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const result = await adapter.exchangeCode('auth-code-123', 'https://example.com/cb');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.accessToken).toBe('access-abc');
      expect(result.refreshToken).toBe('refresh-xyz');
      expect(result.realmId).toBe('realm-001');

      vi.unstubAllGlobals();
    });

    it('throws error on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      }));

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      await expect(adapter.exchangeCode('bad-code', 'https://example.com/cb')).rejects.toThrow('401');

      vi.unstubAllGlobals();
    });
  });

  describe('refreshTokens', () => {
    it('POSTs with grant_type=refresh_token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
        text: vi.fn().mockResolvedValue(''),
      });
      vi.stubGlobal('fetch', fetchMock);

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const result = await adapter.refreshTokens('old-refresh-token');

      const callBody = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string;
      expect(callBody).toContain('grant_type=refresh_token');
      expect(result.accessToken).toBe('new-access');

      vi.unstubAllGlobals();
    });
  });

  describe('createInvoice', () => {
    it('converts cents to dollars in the request', async () => {
      let capturedBody: unknown;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        capturedBody = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ Invoice: { Id: 'inv-001' } }),
          text: vi.fn().mockResolvedValue(''),
        });
      }));

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const result = await adapter.createInvoice('access-token', 'realm-001', {
        customerName: 'Alice',
        lineItems: [{ description: 'Sale', amountCents: 2500, quantity: 1 }],
        datePaid: new Date('2026-01-01'),
        reference: 'order-001',
      });

      expect(result.externalId).toBe('inv-001');
      expect(result.externalType).toBe('INVOICE');

      const body = capturedBody as { Line: Array<{ Amount: number }> };
      expect(body.Line[0]?.Amount).toBe(25);  // 2500 cents = $25.00

      vi.unstubAllGlobals();
    });

    it('throws error on 500 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server error'),
      }));

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      await expect(
        adapter.createInvoice('token', 'realm', {
          customerName: 'Bob',
          lineItems: [{ description: 'item', amountCents: 1000, quantity: 1 }],
          datePaid: new Date(),
          reference: 'ref',
        }),
      ).rejects.toThrow('500');

      vi.unstubAllGlobals();
    });
  });

  describe('createExpense', () => {
    it('sends correct format with cents converted to dollars', async () => {
      let capturedBody: unknown;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        capturedBody = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ Purchase: { Id: 'purch-001' } }),
          text: vi.fn().mockResolvedValue(''),
        });
      }));

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const result = await adapter.createExpense('token', 'realm', {
        vendor: 'USPS',
        category: 'Shipping',
        amountCents: 500,
        date: new Date('2026-01-01'),
        description: 'Shipping supplies',
        reference: 'exp-001',
      });

      expect(result.externalType).toBe('BILL');
      const body = capturedBody as { Line: Array<{ Amount: number }> };
      expect(body.Line[0]?.Amount).toBe(5);  // 500 cents = $5.00

      vi.unstubAllGlobals();
    });
  });

  describe('getCompanyInfo', () => {
    it('returns name and currency', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          CompanyInfo: {
            CompanyName: 'My Shop LLC',
            Country: 'US',
          },
        }),
        text: vi.fn().mockResolvedValue(''),
      }));

      const { QuickBooksAdapter } = await import('../quickbooks-adapter');
      const adapter = new QuickBooksAdapter();
      const info = await adapter.getCompanyInfo('token', 'realm-001');

      expect(info.name).toBe('My Shop LLC');
      expect(info.country).toBe('US');

      vi.unstubAllGlobals();
    });
  });
});
