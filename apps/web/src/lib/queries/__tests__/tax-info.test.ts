import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/encryption', () => ({
  maskTaxId: (lastFour: string, type: string) =>
    type === 'EIN' ? `**-***${lastFour}` : `***-**-${lastFour}`,
}));

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('getTaxInfoByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when no row found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getTaxInfoByUserId } = await import('../tax-info');
    const result = await getTaxInfoByUserId('user-1');

    expect(result).toBeNull();
  });

  it('returns tax info without taxIdEncrypted field', async () => {
    const row = {
      id: 'ti-1',
      userId: 'user-1',
      taxIdType: 'SSN',
      taxIdLastFour: '5678',
      legalName: 'Jane Doe',
      businessName: null,
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
      country: 'US',
      form1099Threshold: false,
      w9ReceivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getTaxInfoByUserId } = await import('../tax-info');
    const result = await getTaxInfoByUserId('user-1');

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('taxIdEncrypted');
    expect(result?.taxIdLastFour).toBe('5678');
  });
});

describe('getTaxInfoForAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns masked SSN in correct format', async () => {
    const row = {
      id: 'ti-1',
      userId: 'user-1',
      taxIdType: 'SSN',
      taxIdLastFour: '5678',
      legalName: 'Jane Doe',
      businessName: null,
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
      country: 'US',
      form1099Threshold: true,
      w9ReceivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getTaxInfoForAdmin } = await import('../tax-info');
    const result = await getTaxInfoForAdmin('user-1');

    expect(result?.maskedTaxId).toBe('***-**-5678');
    expect(result).not.toHaveProperty('taxIdEncrypted');
  });

  it('returns masked EIN in correct format', async () => {
    const row = {
      id: 'ti-2',
      userId: 'user-2',
      taxIdType: 'EIN',
      taxIdLastFour: '1234',
      legalName: 'Corp Inc',
      businessName: 'Corp Inc',
      address1: '1 Corp Dr',
      city: 'NYC',
      state: 'NY',
      zip: '10001',
      country: 'US',
      form1099Threshold: false,
      w9ReceivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getTaxInfoForAdmin } = await import('../tax-info');
    const result = await getTaxInfoForAdmin('user-2');

    expect(result?.maskedTaxId).toBe('**-***1234');
  });

  it('returns null maskedTaxId when no lastFour', async () => {
    const row = {
      id: 'ti-3',
      userId: 'user-3',
      taxIdType: null,
      taxIdLastFour: null,
      legalName: 'John',
      businessName: null,
      address1: '1 St',
      city: 'LA',
      state: 'CA',
      zip: '90001',
      country: 'US',
      form1099Threshold: false,
      w9ReceivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getTaxInfoForAdmin } = await import('../tax-info');
    const result = await getTaxInfoForAdmin('user-3');

    expect(result?.maskedTaxId).toBeNull();
  });
});
