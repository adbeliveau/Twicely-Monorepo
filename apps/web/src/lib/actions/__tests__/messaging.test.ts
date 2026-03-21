/**
 * Tests for createConversation action (messaging-actions.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: vi.fn() };
const mockAuthorize = vi.fn();
const mockIsBuyerBlocked = vi.fn();
const mockNotifyNewMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (s: string, c: Record<string, unknown>) => ({ s, c }),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@/lib/queries/buyer-block', () => ({
  isBuyerBlocked: (...args: unknown[]) => mockIsBuyerBlocked(...args),
}));
vi.mock('@twicely/notifications/message-notifier', () => ({
  notifyNewMessage: (...args: unknown[]) => mockNotifyNewMessage(...args),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../messaging-helpers', () => ({
  getRateLimitPerHour: vi.fn(),
  getMessageCountLastHour: vi.fn(),
  isParticipant: vi.fn(),
  fetchConversation: vi.fn(),
}));

function mockSession(userId: string) {
  return {
    session: { userId, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}
function mockGuest() {
  return { session: null, ability: { can: vi.fn().mockReturnValue(false) } };
}
function makeSelectChain(rows: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(rows),
    then: (r: (v: unknown[]) => void, j?: (e: unknown) => void) =>
      Promise.resolve(rows).then(r, j),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(whereResult) }) };
}
function makeInsert(id: string) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id }]) }) };
}

const BUYER_ID = 'buyer-test-001';
const SELLER_ID = 'seller-test-002';
const LISTING_ID = 'cuid2listingaaaaa';
const CONV_ID = 'cuid2convaaaaaaaa';
const MSG_ID = 'cuid2msgaaaaaaaaa';
const ACTIVE_LISTING = { id: LISTING_ID, status: 'ACTIVE', ownerUserId: SELLER_ID, title: 'Cool Jacket' };

describe('createConversation — authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Please sign in to send messages' });
  });

  it('rejects when CASL denies create Conversation', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'You do not have permission to create conversations' });
  });
});

describe('createConversation — input validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects empty body', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: '' });
    expect(result).toEqual({ success: false, error: 'Message cannot be empty' });
  });

  it('rejects body over 5000 characters', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'A'.repeat(5001) });
    expect(result).toEqual({ success: false, error: 'Message must be under 5000 characters' });
  });

  it('rejects extra unknown fields (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { createConversation } = await import('../messaging-actions');
    const input = Object.assign({ listingId: LISTING_ID, body: 'Hello' }, { extra: 'bad' });
    const result = await createConversation(input);
    expect(result.success).toBe(false);
  });
});

describe('createConversation — business rules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects if listing not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Listing not found' });
  });

  it('rejects if listing is not ACTIVE', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ ...ACTIVE_LISTING, status: 'SOLD' }]));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'This listing is not available' });
  });

  it('rejects if user is the listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(SELLER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'You cannot message yourself.' });
  });

  it('rejects if buyer is blocked by seller', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]));
    mockIsBuyerBlocked.mockResolvedValue(true);
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Unable to send message.' });
  });

  it('returns existing conversation ID when OPEN conversation already exists', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ id: CONV_ID, status: 'OPEN' }]));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: true, conversationId: CONV_ID });
  });

  it('rejects if existing conversation is ARCHIVED', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ id: CONV_ID, status: 'ARCHIVED' }]));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'This conversation is no longer active.' });
  });

  it('creates conversation and returns conversationId on happy path', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValueOnce(makeInsert(CONV_ID)).mockReturnValueOnce(makeInsert(MSG_ID));
    const { createConversation } = await import('../messaging-actions');
    const result = await createConversation({ listingId: LISTING_ID, body: 'Is this available?' });
    expect(result).toEqual({ success: true, conversationId: CONV_ID });
  });

  it('calls notifyNewMessage with message ID after insert', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValueOnce(makeInsert(CONV_ID)).mockReturnValueOnce(makeInsert(MSG_ID));
    const { createConversation } = await import('../messaging-actions');
    await createConversation({ listingId: LISTING_ID, body: 'Is this available?' });
    expect(mockNotifyNewMessage).toHaveBeenCalledWith(MSG_ID);
  });
});
