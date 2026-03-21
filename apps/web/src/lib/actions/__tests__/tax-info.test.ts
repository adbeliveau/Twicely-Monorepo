import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();
const mockDb = {
  insert: mockDbInsert,
  update: mockDbUpdate,
  select: mockDbSelect,
};

const mockAuthorize = vi.fn();
const mockEncrypt = vi.fn();
const mockGetTaxInfo = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));
vi.mock('@/lib/encryption', () => ({
  encrypt: mockEncrypt,
  maskTaxId: (lastFour: string, type: string) =>
    type === 'EIN' ? `**-***${lastFour}` : `***-**-${lastFour}`,
}));
vi.mock('@/lib/queries/tax-info', () => ({ getTaxInfoByUserId: mockGetTaxInfo }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

// ──────────────────── Test helpers ─────────────────────────────────────────

const makeInsertChain = () => ({
  values: vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }),
});

const makeUpdateChain = () => ({
  set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
});

function mockAuthorizedSeller(userId = 'user-1') {
  mockAuthorize.mockResolvedValue({
    session: { userId, isSeller: true },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('saveTaxInfoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '123456789',
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('sign in');
  });

  it('returns error when not authorized', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1' },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '123456789',
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
  });

  it('encrypts SSN before storage and stores last 4 digits', async () => {
    mockAuthorizedSeller();
    mockEncrypt.mockReturnValue('iv:tag:cipher');
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const savedData = { taxIdLastFour: '6789', taxIdType: 'SSN' };
    mockGetTaxInfo.mockResolvedValue(savedData);

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '123456789',
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(true);
    expect(mockEncrypt).toHaveBeenCalledWith('123456789');
    // taxIdEncrypted should NOT appear in the returned data
    expect(result.data).not.toHaveProperty('taxIdEncrypted');
  });

  it('rejects invalid SSN (not 9 digits)', async () => {
    mockAuthorizedSeller();

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '12345', // too short
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('rejects invalid EIN (not 9 digits)', async () => {
    mockAuthorizedSeller();

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'EIN',
      taxId: '1234', // too short
      legalName: 'Business Corp',
      address1: '1 Corp Dr',
      city: 'NYC',
      state: 'NY',
      zip: '10001',
    });

    expect(result.success).toBe(false);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('validates ITIN starts with 9', async () => {
    mockAuthorizedSeller();

    const { saveTaxInfoAction } = await import('../tax-info');
    // Invalid: doesn't start with 9
    const result = await saveTaxInfoAction({
      taxIdType: 'ITIN',
      taxId: '123456789',
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ITIN');
  });

  it('returns masked data only (no taxIdEncrypted in response)', async () => {
    mockAuthorizedSeller();
    mockEncrypt.mockReturnValue('encrypted_value');
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const savedData = {
      id: 'ti-1',
      userId: 'user-1',
      taxIdType: 'SSN',
      taxIdLastFour: '6789',
      legalName: 'Jane Doe',
      // NO taxIdEncrypted field
    };
    mockGetTaxInfo.mockResolvedValue(savedData);

    const { saveTaxInfoAction } = await import('../tax-info');
    const result = await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '123456789',
      legalName: 'Jane Doe',
      address1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('taxIdEncrypted');
    expect(result.data?.taxIdLastFour).toBe('6789');
  });

  it('upserts existing tax info (does not create duplicate)', async () => {
    mockAuthorizedSeller();
    mockEncrypt.mockReturnValue('new_cipher');
    const onConflictFn = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictFn }),
    });
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockGetTaxInfo.mockResolvedValue({ taxIdLastFour: '1111', taxIdType: 'SSN' });

    const { saveTaxInfoAction } = await import('../tax-info');
    await saveTaxInfoAction({
      taxIdType: 'SSN',
      taxId: '111111111',
      legalName: 'Updated Name',
      address1: '456 New St',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
    });

    expect(onConflictFn).toHaveBeenCalled();
  });

  it('sets affiliate.taxInfoProvided when user is an affiliate', async () => {
    mockAuthorizedSeller('affiliate-user-1');
    mockEncrypt.mockReturnValue('cipher');
    mockDbInsert.mockReturnValue(makeInsertChain());
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbUpdate.mockReturnValue({ set: updateSetMock });
    mockGetTaxInfo.mockResolvedValue({ taxIdLastFour: '4321', taxIdType: 'EIN' });

    const { saveTaxInfoAction } = await import('../tax-info');
    await saveTaxInfoAction({
      taxIdType: 'EIN',
      taxId: '432112345',
      legalName: 'Affiliate Corp',
      address1: '1 Biz Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    });

    // update should have been called (for affiliate.taxInfoProvided)
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe('getTaxInfoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns seller own tax info without taxIdEncrypted', async () => {
    mockAuthorizedSeller();
    const taxData = {
      id: 'ti-1',
      userId: 'user-1',
      taxIdType: 'SSN',
      taxIdLastFour: '5678',
      legalName: 'Jane Doe',
    };
    mockGetTaxInfo.mockResolvedValue(taxData);

    const { getTaxInfoAction } = await import('../tax-info');
    const result = await getTaxInfoAction();

    expect(result.success).toBe(true);
    expect(result.data?.taxIdLastFour).toBe('5678');
    expect(result.data).not.toHaveProperty('taxIdEncrypted');
  });

  it('SUPPORT role cannot read TaxInfo (returns not authorized)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'support-1', isPlatformStaff: true, platformRoles: ['SUPPORT'] },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getTaxInfoAction } = await import('../tax-info');
    const result = await getTaxInfoAction();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    expect(mockGetTaxInfo).not.toHaveBeenCalled();
  });
});
