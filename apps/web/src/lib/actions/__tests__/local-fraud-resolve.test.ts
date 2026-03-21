import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localFraudFlag: { id: 'id', status: 'status', sellerId: 'seller_id', listingId: 'listing_id', resolvedByStaffId: 'resolved_by_staff_id', resolvedAt: 'resolved_at', resolutionNote: 'resolution_note', updatedAt: 'updated_at' },
  localTransaction: {},
  orderItem: {},
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  auditEvent: {},
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/commerce/local-fraud-consequences', () => ({
  applyConfirmedFraudConsequences: vi.fn().mockResolvedValue({
    refundIssued: true,
    sellerBanned: true,
    accountSuspended: false,
    listingRemoved: true,
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { applyConfirmedFraudConsequences } from '@twicely/commerce/local-fraud-consequences';
import { resolveLocalFraudFlagAction } from '../local-fraud';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'staff-001';
const FLAG_ID = 'flag-001';
const SELLER_ID = 'seller-001';
const LISTING_ID = 'lst-001';

function makeStaffSession() {
  return { staffUserId: STAFF_ID, email: 'staff@example.com', displayName: 'Staff', isPlatformStaff: true, platformRoles: ['MODERATION'] as const };
}

function makeAbility(canManage = true) {
  return { can: vi.fn().mockReturnValue(canManage) };
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain = { values: vi.fn().mockResolvedValue(undefined) };
  chain.values.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeFlag(status: string = 'OPEN') {
  return {
    id: FLAG_ID,
    status,
    sellerId: SELLER_ID,
    listingId: LISTING_ID,
  };
}

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);
const mockApplyConsequences = vi.mocked(applyConfirmedFraudConsequences);
const mockRevalidatePath = vi.mocked(revalidatePath);

const validConfirmInput = {
  flagId: FLAG_ID,
  resolution: 'CONFIRMED' as const,
  note: 'Verified fraud — item sold to another buyer.',
  applyConsequences: true,
};

const validDismissInput = {
  flagId: FLAG_ID,
  resolution: 'DISMISSED' as const,
  note: 'False positive — transaction completed normally.',
  applyConsequences: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveLocalFraudFlagAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('returns Forbidden when staff lacks manage LocalFraudFlag ability', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility(false) as never,
      session: makeStaffSession() as never,
    });

    const result = await resolveLocalFraudFlagAction(validConfirmInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns Not found when flag does not exist', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await resolveLocalFraudFlagAction(validConfirmInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects resolving already-resolved flags (CONFIRMED)', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeFlag('CONFIRMED')]) as never);

    const result = await resolveLocalFraudFlagAction(validConfirmInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Flag already resolved');
  });

  it('rejects resolving already-resolved flags (DISMISSED)', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeFlag('DISMISSED')]) as never);

    const result = await resolveLocalFraudFlagAction(validConfirmInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Flag already resolved');
  });

  it('confirms flag and applies consequences when resolution=CONFIRMED and applyConsequences=true', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeFlag('OPEN')]) as never);

    const result = await resolveLocalFraudFlagAction(validConfirmInput);

    expect(result.success).toBe(true);
    expect(mockApplyConsequences).toHaveBeenCalledWith(
      expect.objectContaining({
        flagId: FLAG_ID,
        staffId: STAFF_ID,
      }),
    );
  });

  it('dismisses flag without calling applyConsequences', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([makeFlag('OPEN')]) as never)
      .mockReturnValueOnce(makeSelectChain([{ enforcementState: 'CLEAR' }]) as never);

    const result = await resolveLocalFraudFlagAction(validDismissInput);

    expect(result.success).toBe(true);
    expect(mockApplyConsequences).not.toHaveBeenCalled();
  });

  it('revalidates /mod/fraud path after resolution', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeFlag('OPEN')]) as never);

    await resolveLocalFraudFlagAction(validConfirmInput);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/mod/fraud');
  });

  it('returns Invalid input on bad schema', async () => {
    mockStaffAuthorize.mockResolvedValue({
      ability: makeAbility() as never,
      session: makeStaffSession() as never,
    });

    const result = await resolveLocalFraudFlagAction({ flagId: '', resolution: 'CONFIRMED', note: '', applyConsequences: true });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });
});
