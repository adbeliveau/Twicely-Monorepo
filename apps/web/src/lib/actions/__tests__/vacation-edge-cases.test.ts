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
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status' },
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

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getUnfulfilledOrderCount } from '@/lib/queries/vacation';
import { declineAllPendingOffersForListing } from '@twicely/commerce/offer-transitions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-edge-001';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function makeLimitChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
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

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);
const mockDbInsert = vi.mocked(db.insert);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockGetUnfulfilledOrderCount = vi.mocked(getUnfulfilledOrderCount);
const mockDeclineAllPendingOffers = vi.mocked(declineAllPendingOffersForListing);

// ─── activateVacation — additional edge cases ─────────────────────────────────

describe('activateVacation — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
    mockDeclineAllPendingOffers.mockResolvedValue({ declined: 0 });
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
  });

  it('accepts CUSTOM mode and uses maxPauseDays limit', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    // maxPauseDays = 30, maxAllowSalesDays = 15
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(false as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
    // CUSTOM with 10-day duration — within 30-day limit
    const tenDaysOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ storeSlug: null }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'CUSTOM', endAt: tenDaysOut });

    expect(result.success).toBe(true);
  });

  it('rejects PAUSE_SALES duration exceeding maxPauseDays (30)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never);

    const thirtyOneDaysOut = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: thirtyOneDaysOut });

    expect(result.success).toBe(false);
    expect(result.error).toContain('30');
  });

  it('rejects CUSTOM mode duration exceeding maxPauseDays (30)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never);

    const thirtyOneDaysOut = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'CUSTOM', endAt: thirtyOneDaysOut });

    expect(result.success).toBe(false);
    expect(result.error).toContain('30');
  });

  it('stores vacationMessage and autoReplyMessage when provided', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(false as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
    const endAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ storeSlug: 'my-store' }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({
      modeType: 'PAUSE_SALES',
      endAt,
      vacationMessage: 'Store closed for holidays',
      autoReplyMessage: 'Back in January!',
    });

    expect(result.success).toBe(true);
    // Verify db.update was called with the custom messages
    const updateSetArgs = vi.mocked(mockDbUpdate.mock.results[0]?.value.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateSetArgs.vacationMessage).toBe('Store closed for holidays');
    expect(updateSetArgs.vacationAutoReplyMessage).toBe('Back in January!');
  });

  it('reactivating vacation (ALLOW_SALES) within 15-day limit succeeds', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(false as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
    const tenDaysOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ storeSlug: null }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'ALLOW_SALES', endAt: tenDaysOut });

    expect(result.success).toBe(true);
    expect(result.offersDeclined).toBe(0);
  });

  it('auto-decline loop sums offers across multiple listings', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(true as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
    mockDeclineAllPendingOffers
      .mockResolvedValueOnce({ declined: 2 })
      .mockResolvedValueOnce({ declined: 4 })
      .mockResolvedValueOnce({ declined: 1 });

    const endAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDbSelect
      .mockReturnValueOnce(
        makeWhereChain([{ id: 'lst-a' }, { id: 'lst-b' }, { id: 'lst-c' }]) as never,
      )
      .mockReturnValueOnce(makeLimitChain([{ storeSlug: null }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt });

    expect(result.success).toBe(true);
    expect(result.offersDeclined).toBe(7);
    expect(mockDeclineAllPendingOffers).toHaveBeenCalledTimes(3);
  });
});

// ─── deactivateVacation — CASL denial ─────────────────────────────────────────

describe('deactivateVacation — CASL denial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('returns error when CASL denies update on SellerProfile', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(USER_ID) as never,
      ability: makeAbility(false) as never,
    });

    const { deactivateVacation } = await import('../vacation');
    const result = await deactivateVacation();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
