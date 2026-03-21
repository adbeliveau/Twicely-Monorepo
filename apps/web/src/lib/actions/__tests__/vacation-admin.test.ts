import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', vacationMode: 'vacation_mode', storeSlug: 'store_slug' },
  storefront: { ownerUserId: 'owner_user_id', vacationMode: 'vacation_mode' },
  listing: {},
  listingOffer: {},
  auditEvent: {},
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@/lib/queries/vacation', () => ({
  getUnfulfilledOrderCount: vi.fn(),
  getSellerPendingOffersCount: vi.fn(),
}));

vi.mock('@twicely/commerce/offer-transitions', () => ({
  declineAllPendingOffersForListing: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'test-cuid',
}));

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Must be a valid CUID2 for adminForceDeactivateVacationSchema sellerId validation
const SELLER_ID = 'oxnrqr2mip27990tjv282psp';
const STAFF_ID = 'staff-001';

function makeAbility(canManage = true) {
  return { can: vi.fn().mockReturnValue(canManage) };
}
function makeStaffSession() {
  return {
    staffUserId: STAFF_ID,
    email: 'staff@test.com',
    displayName: 'Staff',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
}

function makeLimitChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn() };
  chain.set.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue([]) };
}

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);
const mockDbInsert = vi.mocked(db.insert);

// ─── adminForceDeactivateVacation tests ──────────────────────────────────────

describe('adminForceDeactivateVacation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
  });

  it('returns Forbidden when staff lacks manage permission', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: makeStaffSession() as never, ability: makeAbility(false) as never });

    const { adminForceDeactivateVacation } = await import('../vacation');
    const result = await adminForceDeactivateVacation({ sellerId: SELLER_ID, reason: 'Policy violation' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error when seller not found', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: makeStaffSession() as never, ability: makeAbility(true) as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { adminForceDeactivateVacation } = await import('../vacation');
    const result = await adminForceDeactivateVacation({ sellerId: SELLER_ID, reason: 'Policy violation' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Seller not found');
  });

  it('returns error when seller is not on vacation', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: makeStaffSession() as never, ability: makeAbility(true) as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ vacationMode: false }]) as never);

    const { adminForceDeactivateVacation } = await import('../vacation');
    const result = await adminForceDeactivateVacation({ sellerId: SELLER_ID, reason: 'Policy violation' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Seller is not on vacation');
  });

  it('deactivates seller vacation and creates audit event', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: makeStaffSession() as never, ability: makeAbility(true) as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ vacationMode: true }]) as never);

    const { adminForceDeactivateVacation } = await import('../vacation');
    const result = await adminForceDeactivateVacation({ sellerId: SELLER_ID, reason: 'Policy violation' });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);

    const insertValues = vi.mocked(mockDbInsert.mock.results[0]?.value.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertValues?.action).toBe('admin.vacation.forceDeactivate');
    expect(insertValues?.subject).toBe('SellerProfile');
    expect((insertValues?.detailsJson as Record<string, unknown>)?.reason).toBe('Policy violation');
  });

  it('rejects invalid input — empty reason fails schema validation', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: makeStaffSession() as never, ability: makeAbility(true) as never });

    const { adminForceDeactivateVacation } = await import('../vacation');
    const result = await adminForceDeactivateVacation({ sellerId: SELLER_ID, reason: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
