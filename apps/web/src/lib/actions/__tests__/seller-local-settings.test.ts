import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: {
    update: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { updateSellerLocalSettings } from '../seller-local-settings';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockAuthorize = vi.mocked(authorize);
const mockUpdate = vi.mocked(db.update);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-seller-001',
    isSeller: true,
    delegationId: null,
    onBehalfOfSellerId: null,
    ...overrides,
  };
}

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function updateChain() {
  const setMock = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  mockUpdate.mockReturnValue({ set: setMock } as never);
  return setMock;
}

describe('updateSellerLocalSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(50);
  });

  it('updates maxMeetupDistanceMiles for authenticated seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });
    updateChain();

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 25 });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 10 });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects non-seller users (CASL denies update)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession({ isSeller: false }) as never,
      ability: makeAbility(false) as never,
    });

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 10 });

    expect(result).toEqual({ success: false, error: 'Not authorized' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects distance > 50 miles (Zod ceiling)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 51 });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects distance < 1 mile', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows nullable distance (disable local pickup)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });
    updateChain();

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: null });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects extra fields via strict schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });

    const badInput = { maxMeetupDistanceMiles: 10, extraField: 'bad' };
    const result = await updateSellerLocalSettings(badInput as Parameters<typeof updateSellerLocalSettings>[0]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects distance exceeding platform max radius', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession() as never,
      ability: makeAbility() as never,
    });
    // Platform max is 30 miles, Zod allows up to 50
    mockGetPlatformSetting.mockResolvedValue(30);

    const result = await updateSellerLocalSettings({ maxMeetupDistanceMiles: 40 });

    expect(result).toEqual({ success: false, error: 'Maximum meetup distance is 30 miles' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
