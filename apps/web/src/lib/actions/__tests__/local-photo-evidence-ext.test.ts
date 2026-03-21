import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { uploadMeetupPhotosAction, removeMeetupPhotoAction } from '../local-photo-evidence';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-ext-001';
const SELLER_ID = 'seller-ext-001';
const TX_ID = 'lt-ext-001';
const PHOTO_URL_1 = 'https://cdn.twicely.com/meetup-photos/lt-ext/0-1234.jpg';
const PHOTO_URL_2 = 'https://cdn.twicely.com/meetup-photos/lt-ext/1-1235.jpg';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}
function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status: 'BOTH_CHECKED_IN',
    confirmedAt: null as Date | null,
    meetupPhotoUrls: [] as string[],
    meetupPhotosAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}
function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);

// ─── uploadMeetupPhotosAction — revalidatePath + CASL ────────────────────────

describe('uploadMeetupPhotosAction — additional edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('calls revalidatePath for buying and selling orders on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/buying/orders');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/orders');
  });

  it('does not call revalidatePath when action fails (wrong buyer)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('rejects when CASL ability.can returns false for buyer', async () => {
    // Buyer owns the transaction but CASL denies update
    const restrictedAbility = makeAbility(false);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: restrictedAbility as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects when transaction not found in DB', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects when confirmedAt is set (status BOTH_CHECKED_IN but already confirmed)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ status: 'BOTH_CHECKED_IN', confirmedAt: new Date() }),
    ]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirmed');
  });

  it('returns combined photo list on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ meetupPhotoUrls: [PHOTO_URL_1] }),
    ]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_2] });
    expect(result.success).toBe(true);
    expect(result.photoUrls).toEqual([PHOTO_URL_1, PHOTO_URL_2]);
  });

  it('allows exactly 5 photos (boundary: 4 existing + 1 new)', async () => {
    const existing = [
      'https://cdn.twicely.com/p1.jpg',
      'https://cdn.twicely.com/p2.jpg',
      'https://cdn.twicely.com/p3.jpg',
      'https://cdn.twicely.com/p4.jpg',
    ];
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: existing })]) as never);
    const result = await uploadMeetupPhotosAction({
      localTransactionId: TX_ID,
      photoUrls: ['https://cdn.twicely.com/p5.jpg'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects when status is SELLER_CHECKED_IN', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'SELLER_CHECKED_IN' })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirming receipt');
  });
});

// ─── removeMeetupPhotoAction — additional edge cases ─────────────────────────

describe('removeMeetupPhotoAction — additional edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('calls revalidatePath for buying and selling orders on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/buying/orders');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/orders');
  });

  it('does not call revalidatePath on failure', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('rejects when CASL ability.can returns false', async () => {
    const restrictedAbility = makeAbility(false);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: restrictedAbility as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects when confirmedAt is set even if status allows photos', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ meetupPhotoUrls: [PHOTO_URL_1], confirmedAt: new Date() }),
    ]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirmed');
  });

  it('rejects when status is RECEIPT_CONFIRMED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ status: 'RECEIPT_CONFIRMED', meetupPhotoUrls: [PHOTO_URL_1] }),
    ]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirming receipt');
  });

  it('preserves remaining photos after removal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ meetupPhotoUrls: [PHOTO_URL_1, PHOTO_URL_2] }),
    ]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    const setCalls = updateChain.set.mock.calls as Array<[{ meetupPhotoUrls: string[] }]>;
    expect(setCalls[0]?.[0].meetupPhotoUrls).toEqual([PHOTO_URL_2]);
  });

  it('keeps meetupPhotosAt non-null when photos remain after removal', async () => {
    const existingDate = new Date('2026-03-12T10:00:00Z');
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ meetupPhotoUrls: [PHOTO_URL_1, PHOTO_URL_2], meetupPhotosAt: existingDate }),
    ]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0].meetupPhotosAt).toEqual(existingDate);
  });

  it('rejects invalid Zod input (empty photoUrl)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid Zod input (empty localTransactionId)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await removeMeetupPhotoAction({ localTransactionId: '', photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
