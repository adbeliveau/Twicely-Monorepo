import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

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

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-photo-001';
const PHOTO_URL_1 = 'https://cdn.twicely.com/meetup-photos/lt-001/0-1234.jpg';
const PHOTO_URL_2 = 'https://cdn.twicely.com/meetup-photos/lt-001/1-1235.jpg';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}
function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    orderId: 'ord-001',
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status: 'BOTH_CHECKED_IN',
    confirmedAt: null,
    meetupPhotoUrls: [] as string[],
    meetupPhotosAt: null,
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

// ─── uploadMeetupPhotosAction ─────────────────────────────────────────────────

describe('uploadMeetupPhotosAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('links photo URLs to transaction when buyer is authorized', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(true);
    expect(result.photoUrls).toContain(PHOTO_URL_1);
  });

  it('sets meetupPhotosAt timestamp on first upload', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotosAt: null })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0].meetupPhotosAt).toBeInstanceOf(Date);
  });

  it('does not overwrite meetupPhotosAt on subsequent uploads', async () => {
    const existingDate = new Date('2026-03-12T10:00:00Z');
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1], meetupPhotosAt: existingDate })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_2] });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0].meetupPhotosAt).toEqual(existingDate);
  });

  it('rejects when user is not the buyer', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects when user is the seller', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
  });

  it('rejects when transaction status is SCHEDULED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'SCHEDULED' })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirming receipt');
  });

  it('rejects when transaction status is RECEIPT_CONFIRMED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'RECEIPT_CONFIRMED', confirmedAt: new Date() })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
  });

  it('rejects when transaction status is COMPLETED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'COMPLETED', confirmedAt: new Date() })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
  });

  it('accepts when transaction status is BOTH_CHECKED_IN', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'BOTH_CHECKED_IN' })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(true);
  });

  it('accepts when transaction status is ADJUSTMENT_PENDING', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'ADJUSTMENT_PENDING' })]) as never);
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(true);
  });

  it('rejects when total photos would exceed 5', async () => {
    const existing = [PHOTO_URL_1, PHOTO_URL_2, 'https://cdn.twicely.com/p3.jpg', 'https://cdn.twicely.com/p4.jpg'];
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: existing })]) as never);
    const result = await uploadMeetupPhotosAction({
      localTransactionId: TX_ID,
      photoUrls: ['https://cdn.twicely.com/p5.jpg', 'https://cdn.twicely.com/p6.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum 5');
  });

  it('deduplicates URLs already in the array', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1, PHOTO_URL_2] });
    const setCalls = updateChain.set.mock.calls as Array<[{ meetupPhotoUrls: string[] }]>;
    const saved = setCalls[0]?.[0].meetupPhotoUrls ?? [];
    const uniqueCount = new Set(saved).size;
    expect(uniqueCount).toBe(saved.length);
    expect(saved).toContain(PHOTO_URL_2);
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await uploadMeetupPhotosAction({ localTransactionId: TX_ID, photoUrls: [PHOTO_URL_1] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('rejects invalid Zod input', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await uploadMeetupPhotosAction({ localTransactionId: '', photoUrls: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── removeMeetupPhotoAction ──────────────────────────────────────────────────

describe('removeMeetupPhotoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('removes a photo URL from the array', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1, PHOTO_URL_2] })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(true);
    const setCalls = updateChain.set.mock.calls as Array<[{ meetupPhotoUrls: string[] }]>;
    expect(setCalls[0]?.[0].meetupPhotoUrls).not.toContain(PHOTO_URL_1);
  });

  it('resets meetupPhotosAt to null when array becomes empty', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1], meetupPhotosAt: new Date() })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0].meetupPhotosAt).toBeNull();
  });

  it('rejects when transaction status is COMPLETED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'COMPLETED', confirmedAt: new Date(), meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
  });

  it('rejects when user is not the buyer', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects URL not in the existing array', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: [PHOTO_URL_1] })]) as never);
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_2 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await removeMeetupPhotoAction({ localTransactionId: TX_ID, photoUrl: PHOTO_URL_1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
