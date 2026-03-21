/**
 * Tests for markAsRead, archiveConversation, reportMessage (messaging-manage.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: vi.fn(), update: mockDbUpdate };
const mockAuthorize = vi.fn();
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../messaging-helpers', () => ({
  getRateLimitPerHour: vi.fn(),
  getMessageCountLastHour: vi.fn(),
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
function makeSelectChain(rows: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(rows),
    then: (r: (v: unknown[]) => void, j?: (e: unknown) => void) =>
      Promise.resolve(rows).then(r, j),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(whereResult) }) };
}
function makeUpdate() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

const BUYER_ID = 'buyer-test-001';
const SELLER_ID = 'seller-test-002';
const CONV_ID = 'cuid2convaaaaaaaa';
const MSG_CUID = 'cuid2msgaaaaaaaaa';
const OPEN_CONV = {
  id: CONV_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  status: 'OPEN' as const,
  buyerUnreadCount: 2,
  sellerUnreadCount: 0,
};

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead — authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());
    const { markAsRead } = await import('../messaging-manage');
    expect(await markAsRead({ conversationId: CONV_ID })).toEqual({ success: false, error: 'Please sign in' });
  });

  it('rejects invalid input (strict mode — extra field)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { markAsRead } = await import('../messaging-manage');
    const input = Object.assign({ conversationId: CONV_ID }, { extra: 'bad' });
    const result = await markAsRead(input);
    expect(result.success).toBe(false);
  });
});

describe('markAsRead — authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects when conversation not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(null);
    const { markAsRead } = await import('../messaging-manage');
    expect(await markAsRead({ conversationId: CONV_ID })).toEqual({ success: false, error: 'Not found.' });
  });

  it('rejects non-participant', async () => {
    mockAuthorize.mockResolvedValue(mockSession('outsider-999'));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(false);
    const { markAsRead } = await import('../messaging-manage');
    expect(await markAsRead({ conversationId: CONV_ID })).toEqual({ success: false, error: 'Not found.' });
  });
});

describe('markAsRead — happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('marks messages as read and returns success (2 db.update calls)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockDbUpdate.mockReturnValueOnce(makeUpdate()).mockReturnValueOnce(makeUpdate());
    const { markAsRead } = await import('../messaging-manage');
    const result = await markAsRead({ conversationId: CONV_ID });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });
});

// ─── archiveConversation ──────────────────────────────────────────────────────

describe('archiveConversation — authentication & authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());
    const { archiveConversation } = await import('../messaging-manage');
    expect(await archiveConversation({ conversationId: CONV_ID })).toEqual({ success: false, error: 'Please sign in' });
  });

  it('rejects non-participant', async () => {
    mockAuthorize.mockResolvedValue(mockSession('outsider-999'));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(false);
    const { archiveConversation } = await import('../messaging-manage');
    expect(await archiveConversation({ conversationId: CONV_ID })).toEqual({ success: false, error: 'Not found.' });
  });

  it('rejects when CASL denies update Conversation', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    const { archiveConversation } = await import('../messaging-manage');
    const result = await archiveConversation({ conversationId: CONV_ID });
    expect(result).toEqual({ success: false, error: 'You do not have permission to archive this conversation' });
  });
});

describe('archiveConversation — happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('archives conversation for buyer and returns success', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockDbUpdate.mockReturnValueOnce(makeUpdate());
    const { archiveConversation } = await import('../messaging-manage');
    expect(await archiveConversation({ conversationId: CONV_ID })).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('archives conversation for seller and returns success', async () => {
    mockAuthorize.mockResolvedValue(mockSession(SELLER_ID));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockDbUpdate.mockReturnValueOnce(makeUpdate());
    const { archiveConversation } = await import('../messaging-manage');
    expect(await archiveConversation({ conversationId: CONV_ID })).toEqual({ success: true });
  });
});

// ─── reportMessage ────────────────────────────────────────────────────────────

describe('reportMessage — authentication & validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());
    const { reportMessage } = await import('../messaging-manage');
    expect(await reportMessage({ messageId: MSG_CUID, reason: 'Spam here' })).toEqual({ success: false, error: 'Please sign in' });
  });

  it('rejects reason under 5 characters', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { reportMessage } = await import('../messaging-manage');
    const result = await reportMessage({ messageId: MSG_CUID, reason: 'Hi' });
    expect(result).toEqual({ success: false, error: 'Reason must be at least 5 characters' });
  });

  it('rejects reason over 500 characters', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    const { reportMessage } = await import('../messaging-manage');
    const result = await reportMessage({ messageId: MSG_CUID, reason: 'A'.repeat(501) });
    expect(result).toEqual({ success: false, error: 'Reason must be under 500 characters' });
  });
});

describe('reportMessage — authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects if message not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { reportMessage } = await import('../messaging-manage');
    expect(await reportMessage({ messageId: MSG_CUID, reason: 'Offensive content' })).toEqual({ success: false, error: 'Not found.' });
  });

  it('rejects non-participant reporter', async () => {
    mockAuthorize.mockResolvedValue(mockSession('outsider-999'));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: MSG_CUID, conversationId: CONV_ID }]));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(false);
    const { reportMessage } = await import('../messaging-manage');
    expect(await reportMessage({ messageId: MSG_CUID, reason: 'Offensive content here' })).toEqual({ success: false, error: 'Not found.' });
  });
});

describe('reportMessage — happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('flags conversation and returns success for valid report', async () => {
    mockAuthorize.mockResolvedValue(mockSession(BUYER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: MSG_CUID, conversationId: CONV_ID }]));
    mockFetchConversation.mockResolvedValue(OPEN_CONV);
    mockIsParticipant.mockReturnValue(true);
    mockDbUpdate.mockReturnValueOnce(makeUpdate());
    const { reportMessage } = await import('../messaging-manage');
    const result = await reportMessage({ messageId: MSG_CUID, reason: 'Off-platform payment request' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });
});
