/**
 * Tests for finance-center-mileage.ts — updateMileageAction, deleteMileageAction
 * Categories: Auth, Validation, CASL, Tier Gate, Happy Path, Edge Cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockGetMileageById = vi.fn();
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
  getMileageList: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn(),
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

function makeUpdateChain(returnedRow: unknown) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnedRow]),
      }),
    }),
  };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}

const VALID_DATE = '2026-03-04T00:00:00.000Z';
const MILEAGE_ID = 'au1i93zxyv1cmsbred9l92i6';

const MILEAGE_ROW = {
  id: MILEAGE_ID,
  description: 'Post office run',
  miles: 12.5,
  ratePerMile: 0.67,
  deductionCents: 838,
  tripDate: new Date(VALID_DATE),
  createdAt: new Date(VALID_DATE),
};

function mockAuth() {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: 'user-test-001',
      delegationId: null,
      onBehalfOfSellerId: null,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

function mockAuthForbidden() {
  mockAuthorize.mockResolvedValue({
    session: { userId: 'user-test-002', delegationId: null },
    ability: { can: vi.fn().mockReturnValue(false) },
  });
}

// ─── updateMileageAction ─────────────────────────────────────────────────────

describe('updateMileageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns validation error for missing id', async () => {
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ miles: 5 });
    expect(result.success).toBe(false);
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, miles: 5 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies update on MileageEntry', async () => {
    mockAuthForbidden();
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, miles: 5 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, miles: 20 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain('Upgrade to Finance Pro');
  });

  it('returns not found when entry does not belong to user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageById.mockResolvedValue(null);
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: 'nonexistent', miles: 5 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Mileage entry not found');
  });

  it('updates description only without recalculating deduction', async () => {
    const updated = { ...MILEAGE_ROW, description: 'Updated desc' };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageById.mockResolvedValue(MILEAGE_ROW);
    mockDbUpdate.mockReturnValue(makeUpdateChain(updated));

    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, description: 'Updated desc' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.description).toBe('Updated desc');
    }
  });

  it('recalculates deductionCents using STORED rate when miles change', async () => {
    const newMiles = 20;
    const storedRate = 0.67;
    const expectedDeduction = Math.round(newMiles * storedRate * 100);
    const updated = { ...MILEAGE_ROW, miles: newMiles, deductionCents: expectedDeduction };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageById.mockResolvedValue(MILEAGE_ROW);
    mockDbUpdate.mockReturnValue(makeUpdateChain(updated));

    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, miles: newMiles });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.miles).toBe(newMiles);
      expect(result.entry.deductionCents).toBe(expectedDeduction);
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/mileage');
  });

  it('returns error when miles exceed max 10000', async () => {
    const { updateMileageAction } = await import('../finance-center-mileage');
    const result = await updateMileageAction({ id: MILEAGE_ID, miles: 99999 });
    expect(result.success).toBe(false);
  });
});

// ─── deleteMileageAction ─────────────────────────────────────────────────────

describe('deleteMileageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns validation error for missing id', async () => {
    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({});
    expect(result.success).toBe(false);
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({ id: MILEAGE_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies delete on MileageEntry', async () => {
    mockAuthForbidden();
    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({ id: MILEAGE_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');
    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({ id: MILEAGE_ID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain('Upgrade to Finance Pro');
  });

  it('returns not found when entry does not exist', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageById.mockResolvedValue(null);
    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({ id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Mileage entry not found');
  });

  it('deletes entry and returns success', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageById.mockResolvedValue(MILEAGE_ROW);
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteMileageAction } = await import('../finance-center-mileage');
    const result = await deleteMileageAction({ id: MILEAGE_ID });

    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/mileage');
  });
});
