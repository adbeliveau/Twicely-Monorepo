/**
 * Tests for sendMessage action (messaging-actions.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: vi.fn(), insert: mockDbInsert, update: mockDbUpdate };
const mockAuthorize = vi.fn();
const mockIsBuyerBlocked = vi.fn();
const mockNotifyNewMessage = vi.fn().mockResolvedValue(undefined);
const mockGetMessageCountLastHour = vi.fn();
const mockGetRateLimitPerHour = vi.fn();
const mockFetchConversation = vi.fn();
const mockIsParticipant = vi.fn();

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
  getRateLimitPerHour: (...args: unknown[]) => mockGetRateLimitPerHour(...args),
  getMessageCountLastHour: (...args: unknown[]) => mockGetMessageCountLastHour(...args),
  isParticipant: (...args: unknown[]) => mockIsParticipant(...args),
  fetchConversation: (...args: unknown[]) => mockFetchConversation(...args),
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
function makeInsert(id: string) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id }]) }) };
}
function makeUpdate() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

const BUYER_ID = 'buyer-test-001';
const SELLER_ID = 'seller-test-002';
const CONV_ID = 'cuid2convaaaaaaaa';
const MSG_ID = 'cuid2msgaaaaaaaaa';
const OPEN_CONV = {
  id: CONV_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  status: 'OPEN' as const,
  buyerUnreadCount: 0,
  sellerUnreadCount: 0,
};

describe('sendMessage — authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Please sign in to send messages' });
  });

  it('rejects when CASL denies create Message', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'You do not have permission to send messages' });
  });
});

describe('sendMessage — input validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects empty body', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: '' });
    expect(result).toEqual({ success: false, error: 'Message cannot be empty' });
  });

  it('rejects body over 5000 characters', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'A'.repeat(5001) });
    expect(result).toEqual({ success: false, error: 'Message must be under 5000 characters' });
  });

  it('rejects more than 4 attachments', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({
      conversationId: CONV_ID,
      body: 'Hello',
      attachments: ['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg', 'https://a.com/4.jpg', 'https://a.com/5.jpg'],
    });
    expect(result).toEqual({ success: false, error: 'Maximum 4 images per message' });
  });

  it('rejects unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { sendMessage } = await import('../messaging-actions');
    const input = Object.assign({ conversationId: CONV_ID, body: 'Hello' }, { extra: 'bad' });
    const result = await sendMessage(input);
    expect(result.success).toBe(false);
  });
});

describe('sendMessage — business rules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects if conversation not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(null);
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Not found.' });
  });

  it('rejects if user is not a participant', async () => {
    mockAuthorize.mockResolvedValue(mockSession('outsider-999'));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(false);
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'Not found.' });
  });

  it('rejects if conversation is not OPEN', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue({ ...OPEN_CONV, status: 'ARCHIVED' });
    mockIsParticipant.mockReturnValue(true);
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'This conversation is closed.' });
  });

  it('rejects when rate limit is reached (msgCount >= rateLimit)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockGetMessageCountLastHour.mockResolvedValue(20);
    mockGetRateLimitPerHour.mockResolvedValue(20);
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Hello' });
    expect(result).toEqual({ success: false, error: 'You are sending messages too quickly. Please try again later.' });
  });

  it('flags conversation on off-platform content but sends message (does not block)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockGetMessageCountLastHour.mockResolvedValue(0);
    mockGetRateLimitPerHour.mockResolvedValue(20);
    mockDbUpdate.mockReturnValue(makeUpdate());
    mockDbInsert.mockReturnValueOnce(makeInsert(MSG_ID));
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Pay me via Venmo' });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe(MSG_ID);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('sends message and returns messageId on happy path', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockGetMessageCountLastHour.mockResolvedValue(5);
    mockGetRateLimitPerHour.mockResolvedValue(20);
    mockDbUpdate.mockReturnValue(makeUpdate());
    mockDbInsert.mockReturnValueOnce(makeInsert(MSG_ID));
    const { sendMessage } = await import('../messaging-actions');
    const result = await sendMessage({ conversationId: CONV_ID, body: 'Looks great!' });
    expect(result).toEqual({ success: true, messageId: MSG_ID });
  });

  it('calls notifyNewMessage after successful send', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockGetMessageCountLastHour.mockResolvedValue(0);
    mockGetRateLimitPerHour.mockResolvedValue(20);
    mockDbUpdate.mockReturnValue(makeUpdate());
    mockDbInsert.mockReturnValueOnce(makeInsert(MSG_ID));
    const { sendMessage } = await import('../messaging-actions');
    await sendMessage({ conversationId: CONV_ID, body: 'Looks great!' });
    expect(mockNotifyNewMessage).toHaveBeenCalledWith(MSG_ID);
  });
});
