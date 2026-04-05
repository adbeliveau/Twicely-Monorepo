/**
 * Tests for Xero adapter — G10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPlatformSetting = vi.fn();

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

function setupDefaultSettings() {
  mockGetPlatformSetting.mockImplementation((key: string, defaultValue: unknown) => {
    const settings: Record<string, unknown> = {
      'accounting.xero.authUrl': 'https://login.xero.com/identity/connect/authorize',
      'accounting.xero.clientId': 'xero-client-id',
      'accounting.xero.scopes': 'openid profile email accounting.transactions',
      'accounting.xero.tokenUrl': 'https://identity.xero.com/connect/token',
      'accounting.xero.clientSecret': 'xero-client-secret',
      'accounting.xero.apiUrl': 'https://api.xero.com/api.xro/2.0',
    };
    return settings[key] ?? defaultValue;
  });
}

describe('XeroAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultSettings();
  });

  describe('getAuthorizationUrl', () => {
    it('includes clientId, scopes, and state in URL', async () => {
      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      const url = await adapter.getAuthorizationUrl('xero-state-456', 'https://example.com/callback');

      expect(url).toContain('client_id=xero-client-id');
      expect(url).toContain('state=xero-state-456');
      expect(url).toContain('accounting.transactions');
    });

    it('uses Xero auth URL from platform setting', async () => {
      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      const url = await adapter.getAuthorizationUrl('state', 'https://example.com/cb');
      expect(url).toContain('login.xero.com');
    });
  });

  describe('exchangeCode', () => {
    it('returns tokens with tenantId from connections endpoint', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            access_token: 'xero-access',
            refresh_token: 'xero-refresh',
            expires_in: 1800,
          }),
          text: vi.fn().mockResolvedValue(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([{ tenantId: 'tenant-001' }]),
          text: vi.fn().mockResolvedValue(''),
        });
      vi.stubGlobal('fetch', fetchMock);

      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      const result = await adapter.exchangeCode('xero-code', 'https://example.com/cb');

      expect(result.accessToken).toBe('xero-access');
      expect(result.tenantId).toBe('tenant-001');

      vi.unstubAllGlobals();
    });

    it('throws error on non-ok token response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request'),
      }));

      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      await expect(adapter.exchangeCode('bad-code', 'https://example.com/cb')).rejects.toThrow('400');

      vi.unstubAllGlobals();
    });
  });

  describe('createInvoice', () => {
    it('sends tenantId header and converts cents to dollars', async () => {
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: unknown;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        capturedBody = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ Invoices: [{ InvoiceID: 'xero-inv-001' }] }),
          text: vi.fn().mockResolvedValue(''),
        });
      }));

      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      const result = await adapter.createInvoice('xero-token', 'tenant-001', {
        customerName: 'Bob',
        lineItems: [{ description: 'Sale item', amountCents: 3000, quantity: 1 }],
        datePaid: new Date('2026-01-01'),
        reference: 'order-002',
      });

      expect(result.externalId).toBe('xero-inv-001');
      expect(capturedHeaders['Xero-Tenant-Id']).toBe('tenant-001');

      const body = capturedBody as { LineItems: Array<{ UnitAmount: number }> };
      expect(body.LineItems[0]?.UnitAmount).toBe(30);  // 3000 cents = $30.00

      vi.unstubAllGlobals();
    });
  });

  describe('getCompanyInfo', () => {
    it('returns organisation name and currency', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          Organisations: [{ Name: 'Xero Test Corp', BaseCurrency: 'AUD', CountryCode: 'AU' }],
        }),
        text: vi.fn().mockResolvedValue(''),
      }));

      const { XeroAdapter } = await import('../xero-adapter');
      const adapter = new XeroAdapter();
      const info = await adapter.getCompanyInfo('xero-token', 'tenant-001');

      expect(info.name).toBe('Xero Test Corp');
      expect(info.currency).toBe('AUD');
      expect(info.country).toBe('AU');

      vi.unstubAllGlobals();
    });
  });
});
