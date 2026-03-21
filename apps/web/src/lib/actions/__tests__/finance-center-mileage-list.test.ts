/**
 * Tests for finance-center-mileage.ts — listMileageAction
 * Categories: Auth, Validation, CASL, Happy Path, Edge Cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetMileageList = vi.fn();
const mockGetFinanceTier = vi.fn();

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
  getMileageById: vi.fn(),
  getMileageList: (...args: unknown[]) => mockGetMileageList(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  revalidatePath: vi.fn(),
}));

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

// ─── listMileageAction ───────────────────────────────────────────────────────

describe('listMileageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns validation error for pageSize exceeding 100', async () => {
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it('returns Forbidden when CASL denies read on MileageEntry', async () => {
    mockAuthForbidden();
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns paginated list for authorized user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageList.mockResolvedValue({
      entries: [MILEAGE_ROW], total: 1, page: 1, pageSize: 20,
    });
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.entries).toHaveLength(1);
    }
  });

  it('listMileageAction returns error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Upgrade to Finance Pro to view mileage');
  });

  it('returns error when query throws', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageList.mockRejectedValue(new Error('DB error'));
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to load mileage entries');
  });

  it('returns validation error for unknown fields (strict schema)', async () => {
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({ page: 1, pageSize: 20, unknownField: true });
    expect(result.success).toBe(false);
  });

  it('accepts date filters for startDate and endDate', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetMileageList.mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 20 });
    const { listMileageAction } = await import('../finance-center-mileage');
    const result = await listMileageAction({
      page: 1,
      pageSize: 20,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-03-04T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(0);
    }
  });
});
