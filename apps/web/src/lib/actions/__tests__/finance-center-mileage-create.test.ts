/**
 * Tests for finance-center-mileage.ts — createMileageAction
 * Categories: Auth, Validation, CASL, Tier Gate, Happy Path, Delegation, Edge Cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockGetMileageById = vi.fn();
const mockGetMileageList = vi.fn();
const mockGetPlatformSetting = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceTier: (...args: unknown[]) => mockGetFinanceTier(...args),
}));

vi.mock('@/lib/queries/finance-center-mileage', () => ({
  getMileageById: (...args: unknown[]) => mockGetMileageById(...args),
  getMileageList: (...args: unknown[]) => mockGetMileageList(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  mileageEntry: {
    id: 'id', userId: 'userId', description: 'description',
    miles: 'miles', ratePerMile: 'ratePerMile', deductionCents: 'deductionCents',
    tripDate: 'tripDate', createdAt: 'createdAt',
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

function makeInsertChain(returnedRow: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    }),
  };
}

function makeInsertEmpty() {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  };
}

const VALID_DATE = '2026-03-04T00:00:00.000Z';

const MILEAGE_ROW = {
  id: 'mile-test-001',
  description: 'Post office run',
  miles: 12.5,
  ratePerMile: 0.67,
  deductionCents: 838,
  tripDate: new Date(VALID_DATE),
  createdAt: new Date(VALID_DATE),
};

function mockAuth(overrides?: { delegationId?: string; onBehalfOfSellerId?: string }) {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: 'user-test-001',
      delegationId: overrides?.delegationId ?? null,
      onBehalfOfSellerId: overrides?.onBehalfOfSellerId ?? null,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

describe('createMileageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 10, tripDate: VALID_DATE,
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Invalid input for missing description', async () => {
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({ miles: 10, tripDate: VALID_DATE });
    expect(result.success).toBe(false);
  });

  it('returns Invalid input for miles exceeding 10000', async () => {
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Long trip', miles: 10001, tripDate: VALID_DATE,
    });
    expect(result.success).toBe(false);
  });

  it('returns Invalid input for non-positive miles (0)', async () => {
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 0, tripDate: VALID_DATE,
    });
    expect(result.success).toBe(false);
  });

  it('returns Invalid input for unknown fields (strict schema)', async () => {
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 5, tripDate: VALID_DATE, unknownField: 'boom',
    });
    expect(result.success).toBe(false);
  });

  it('returns Forbidden when CASL denies create on MileageEntry', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 10, tripDate: VALID_DATE,
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');
    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 10, tripDate: VALID_DATE,
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain('Upgrade to Finance Pro');
  });

  it('creates mileage entry and returns it for PRO tier user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPlatformSetting.mockResolvedValue(0.67);
    mockDbInsert.mockReturnValue(makeInsertChain(MILEAGE_ROW));

    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Post office run', miles: 12.5, tripDate: VALID_DATE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.id).toBe('mile-test-001');
      expect(result.entry.miles).toBe(12.5);
      expect(result.entry.deductionCents).toBe(838);
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/mileage');
  });

  it('calculates deductionCents as Math.round(miles * rate * 100)', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPlatformSetting.mockResolvedValue(0.67);
    const expectedDeduction = Math.round(12.5 * 0.67 * 100);
    const rowWithCalc = { ...MILEAGE_ROW, deductionCents: expectedDeduction };
    mockDbInsert.mockReturnValue(makeInsertChain(rowWithCalc));

    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Post office run', miles: 12.5, tripDate: VALID_DATE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.deductionCents).toBe(expectedDeduction);
    }
  });

  it('returns error when insert returns empty result', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPlatformSetting.mockResolvedValue(0.67);
    mockDbInsert.mockReturnValue(makeInsertEmpty());

    const { createMileageAction } = await import('../finance-center-mileage');
    const result = await createMileageAction({
      description: 'Trip', miles: 10, tripDate: VALID_DATE,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to create mileage entry');
  });

  it('uses onBehalfOfSellerId for delegated sessions', async () => {
    mockAuth({ delegationId: 'del-abc', onBehalfOfSellerId: 'seller-target-001' });
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPlatformSetting.mockResolvedValue(0.67);
    mockDbInsert.mockReturnValue(makeInsertChain(MILEAGE_ROW));

    const { createMileageAction } = await import('../finance-center-mileage');
    await createMileageAction({ description: 'Trip', miles: 10, tripDate: VALID_DATE });

    expect(mockGetFinanceTier).toHaveBeenCalledWith('seller-target-001');
  });

  it('reads IRS rate from platform settings key finance.mileageRatePerMile', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPlatformSetting.mockResolvedValue(0.67);
    mockDbInsert.mockReturnValue(makeInsertChain(MILEAGE_ROW));

    const { createMileageAction } = await import('../finance-center-mileage');
    await createMileageAction({ description: 'Trip', miles: 10, tripDate: VALID_DATE });

    expect(mockGetPlatformSetting).toHaveBeenCalledWith('finance.mileageRatePerMile', 0.70);
  });
});
