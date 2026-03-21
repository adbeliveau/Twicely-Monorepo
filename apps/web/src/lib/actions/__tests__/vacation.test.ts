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

const USER_ID = 'user-001';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function makeWhereChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  return chain;
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

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);
const mockDbInsert = vi.mocked(db.insert);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockGetUnfulfilledOrderCount = vi.mocked(getUnfulfilledOrderCount);
const mockDeclineAllPendingOffers = vi.mocked(declineAllPendingOffersForListing);

const FUTURE_DATE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const FAR_FUTURE_DATE = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

// ─── activateVacation tests ───────────────────────────────────────────────────

describe('activateVacation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
    mockDeclineAllPendingOffers.mockResolvedValue({ declined: 0 });
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: FUTURE_DATE });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Please sign in');
  });

  it('returns error for CASL denial', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility(false) as never });
    mockGetPlatformSetting.mockResolvedValue(30 as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: FUTURE_DATE });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
  });

  it('rejects end date in the past', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting.mockResolvedValue(30 as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: PAST_DATE });

    expect(result.success).toBe(false);
    expect(result.error).toContain('future');
  });

  it('rejects ALLOW_SALES duration exceeding 15 days', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never);

    const twentyDaysOut = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'ALLOW_SALES', endAt: twentyDaysOut });

    expect(result.success).toBe(false);
    expect(result.error).toContain('15');
  });

  it('activates vacation and returns unfulfilledOrderCount and offersDeclined', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(true as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(2);
    mockDeclineAllPendingOffers.mockResolvedValue({ declined: 3 });
    mockDbSelect
      .mockReturnValueOnce(makeWhereChain([{ id: 'lst-1' }, { id: 'lst-2' }]) as never)
      .mockReturnValueOnce(makeLimitChain([{ storeSlug: 'my-store' }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: FUTURE_DATE });

    expect(result.success).toBe(true);
    expect(result.unfulfilledOrderCount).toBe(2);
    expect(result.offersDeclined).toBe(6);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns validation error for invalid modeType', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'INVALID_MODE' as never, endAt: FUTURE_DATE });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects start date after end date', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', startAt: FAR_FUTURE_DATE, endAt: FUTURE_DATE });

    expect(result.success).toBe(false);
    expect(result.error).toContain('before end date');
  });

  it('does not auto-decline when setting is false', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockGetPlatformSetting
      .mockResolvedValueOnce(30 as never)
      .mockResolvedValueOnce(15 as never)
      .mockResolvedValueOnce(false as never);
    mockGetUnfulfilledOrderCount.mockResolvedValue(0);
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ storeSlug: null }]) as never);

    const { activateVacation } = await import('../vacation');
    const result = await activateVacation({ modeType: 'PAUSE_SALES', endAt: FUTURE_DATE });

    expect(result.success).toBe(true);
    expect(result.offersDeclined).toBe(0);
    expect(mockDeclineAllPendingOffers).not.toHaveBeenCalled();
  });
});

// ─── deactivateVacation tests ─────────────────────────────────────────────────

describe('deactivateVacation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });

    const { deactivateVacation } = await import('../vacation');
    const result = await deactivateVacation();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Please sign in');
  });

  it('returns error when not on vacation', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ vacationMode: false, storeSlug: null }]) as never);

    const { deactivateVacation } = await import('../vacation');
    const result = await deactivateVacation();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not currently on vacation');
  });

  it('clears all vacation fields on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ vacationMode: true, storeSlug: 'my-store' }]) as never);

    const { deactivateVacation } = await import('../vacation');
    const result = await deactivateVacation();

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns not found when seller profile missing', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(USER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { deactivateVacation } = await import('../vacation');
    const result = await deactivateVacation();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});
