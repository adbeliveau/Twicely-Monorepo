import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockGetPlatformSetting = vi.fn();
const mockFetch = vi.fn();

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock global fetch
vi.stubGlobal('fetch', mockFetch);

// ──────────────────── Tests ────────────────────────────────────────────────

describe('TaxJarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Remove TAXJAR_API_KEY by default
    delete process.env.TAXJAR_API_KEY;
  });

  it('returns $0 tax when TAXJAR_API_KEY is not set', async () => {
    const { TaxJarProvider } = await import('../tax-service');
    const provider = new TaxJarProvider();
    const result = await provider.calculateTax({
      subtotalCents: 5000,
      shippingCents: 500,
      buyerAddress: { state: 'CA', city: 'Los Angeles', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    expect(result.taxCents).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls TaxJar API with dollar amounts (not cents)', async () => {
    process.env.TAXJAR_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tax: {
          amount_to_collect: 4.50,
          rate: 0.09,
          jurisdictions: { state: 'CA' },
        },
      }),
    });

    const { TaxJarProvider } = await import('../tax-service');
    const provider = new TaxJarProvider();
    await provider.calculateTax({
      subtotalCents: 5000,
      shippingCents: 500,
      buyerAddress: { state: 'CA', city: 'Los Angeles', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    const rawCall = mockFetch.mock.calls[0];
    const callBody = JSON.parse((rawCall![1] as RequestInit).body as string);
    // Should be in dollars, not cents
    expect(callBody.amount).toBe(50.00);
    expect(callBody.shipping).toBe(5.00);
  });

  it('converts TaxJar dollar result back to cents', async () => {
    process.env.TAXJAR_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tax: { amount_to_collect: 4.50, rate: 0.09, jurisdictions: {} },
      }),
    });

    const { TaxJarProvider } = await import('../tax-service');
    const provider = new TaxJarProvider();
    const result = await provider.calculateTax({
      subtotalCents: 5000,
      shippingCents: 0,
      buyerAddress: { state: 'CA', city: 'LA', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    expect(result.taxCents).toBe(450); // $4.50 = 450 cents
  });

  it('returns $0 when TaxJar API returns non-OK status', async () => {
    process.env.TAXJAR_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { TaxJarProvider } = await import('../tax-service');
    const provider = new TaxJarProvider();
    const result = await provider.calculateTax({
      subtotalCents: 5000,
      shippingCents: 0,
      buyerAddress: { state: 'CA', city: 'LA', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    expect(result.taxCents).toBe(0);
  });

  it('returns $0 gracefully when TaxJar API throws', async () => {
    process.env.TAXJAR_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { TaxJarProvider } = await import('../tax-service');
    const provider = new TaxJarProvider();
    const result = await provider.calculateTax({
      subtotalCents: 5000,
      shippingCents: 0,
      buyerAddress: { state: 'CA', city: 'LA', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    expect(result.taxCents).toBe(0);
  });
});

describe('calculateSalesTax', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.TAXJAR_API_KEY;
  });

  it('returns $0 when tax.facilitatorEnabled is false', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);

    const { calculateSalesTax } = await import('../tax-service');
    const result = await calculateSalesTax({
      subtotalCents: 5000,
      shippingCents: 0,
      buyerAddress: { state: 'CA', city: 'LA', zip: '90001' },
      sellerAddress: { state: 'CA' },
    });

    expect(result.taxCents).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call TaxJar when facilitatorEnabled is false', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);
    process.env.TAXJAR_API_KEY = 'test-key';

    const { calculateSalesTax } = await import('../tax-service');
    await calculateSalesTax({
      subtotalCents: 10000,
      shippingCents: 500,
      buyerAddress: { state: 'NY', city: 'NYC', zip: '10001' },
      sellerAddress: { state: 'NY' },
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls provider when facilitatorEnabled is true', async () => {
    mockGetPlatformSetting.mockResolvedValue(true);
    process.env.TAXJAR_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tax: { amount_to_collect: 0.89, rate: 0.089, jurisdictions: {} } }),
    });

    const { calculateSalesTax } = await import('../tax-service');
    const result = await calculateSalesTax({
      subtotalCents: 1000,
      shippingCents: 0,
      buyerAddress: { state: 'TX', city: 'Austin', zip: '78701' },
      sellerAddress: { state: 'TX' },
    });

    expect(result.taxCents).toBe(89);
    expect(mockFetch).toHaveBeenCalled();
  });
});
