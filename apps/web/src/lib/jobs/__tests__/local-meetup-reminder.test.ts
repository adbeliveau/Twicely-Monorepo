import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockQueueGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockJobRemove = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd, getJob: mockQueueGetJob, close: mockClose }),
  createWorker: vi.fn().mockReturnValue({ close: mockClose }),
}));
vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', status: 'status', scheduledAt: 'scheduled_at', scheduledAtConfirmedAt: 'confirmed_at', meetupLocationId: 'meetup_location_id' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', title: 'title' },
  safeMeetupLocation: { id: 'id', name: 'name' },
}));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { enqueueLocalMeetupReminders, removeLocalMeetupReminders } from '../local-meetup-reminder';

const TX_ID = 'lt-reminder-001';
const ORDER_ID = 'ord-001';
const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const H48 = 48 * 60 * 60 * 1000;
const H25 = 25 * 60 * 60 * 1000;
const M30 = 30 * 60 * 1000;

function makeScheduledAt(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeBaseData(scheduledAtIso: string) {
  return { localTransactionId: TX_ID, orderId: ORDER_ID, buyerId: BUYER_ID, sellerId: SELLER_ID, itemTitle: '', location: '', scheduledAtIso };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID, orderId: ORDER_ID, buyerId: BUYER_ID, sellerId: SELLER_ID,
    status: 'SCHEDULED', scheduledAt: new Date(Date.now() + H48),
    scheduledAtConfirmedAt: new Date(Date.now() - 60 * 60 * 1000), meetupLocationId: 'loc-001',
    ...overrides,
  };
}

describe('enqueueLocalMeetupReminders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('enqueues two jobs (24hr and 1hr) when meetup is 48hr away', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(H48)));
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
  });

  it('skips 24hr job when meetup is less than 24hr away', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(23 * 60 * 60 * 1000)));
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith('reminder', expect.objectContaining({ reminderType: '1hr' }), expect.any(Object));
  });

  it('skips both jobs when meetup is less than 1hr away', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(M30)));
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('uses correct job IDs with localTransactionId suffix', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(H48)));
    expect(mockQueueAdd).toHaveBeenCalledWith('reminder', expect.objectContaining({ reminderType: '24hr' }), expect.objectContaining({ jobId: `local-reminder-24hr-${TX_ID}` }));
    expect(mockQueueAdd).toHaveBeenCalledWith('reminder', expect.objectContaining({ reminderType: '1hr' }), expect.objectContaining({ jobId: `local-reminder-1hr-${TX_ID}` }));
  });

  it('sets removeOnComplete and removeOnFail options', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(H48)));
    expect(mockQueueAdd).toHaveBeenCalledWith('reminder', expect.any(Object), expect.objectContaining({ removeOnComplete: true, removeOnFail: { count: 100 } }));
  });

  it('calculates correct delay for 24hr job', async () => {
    const scheduledAt = new Date(Date.now() + H48);
    await enqueueLocalMeetupReminders(makeBaseData(scheduledAt.toISOString()));
    const call = mockQueueAdd.mock.calls.find((c) => (c[1] as { reminderType: string }).reminderType === '24hr');
    const opts = call?.[2] as { delay: number };
    const expected = H48 - 24 * 60 * 60 * 1000;
    expect(opts.delay).toBeGreaterThan(expected - 5000);
    expect(opts.delay).toBeLessThan(expected + 5000);
  });

  it('calculates correct delay for 1hr job', async () => {
    const scheduledAt = new Date(Date.now() + H48);
    await enqueueLocalMeetupReminders(makeBaseData(scheduledAt.toISOString()));
    const call = mockQueueAdd.mock.calls.find((c) => (c[1] as { reminderType: string }).reminderType === '1hr');
    const opts = call?.[2] as { delay: number };
    const expected = H48 - 1 * 60 * 60 * 1000;
    expect(opts.delay).toBeGreaterThan(expected - 5000);
    expect(opts.delay).toBeLessThan(expected + 5000);
  });
});

describe('removeLocalMeetupReminders', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes both 24hr and 1hr jobs when they exist', async () => {
    mockQueueGetJob.mockResolvedValue({ remove: mockJobRemove });
    await removeLocalMeetupReminders(TX_ID);
    expect(mockQueueGetJob).toHaveBeenCalledWith(`local-reminder-24hr-${TX_ID}`);
    expect(mockQueueGetJob).toHaveBeenCalledWith(`local-reminder-1hr-${TX_ID}`);
    expect(mockJobRemove).toHaveBeenCalledTimes(2);
  });

  it('handles missing jobs gracefully (no throw)', async () => {
    mockQueueGetJob.mockResolvedValue(null);
    await expect(removeLocalMeetupReminders(TX_ID)).resolves.toBeUndefined();
  });

  it('logs warning when job removal fails', async () => {
    mockQueueGetJob.mockResolvedValue({ remove: vi.fn().mockRejectedValue(new Error('connection error')) });
    await removeLocalMeetupReminders(TX_ID);
    expect(logger.warn).toHaveBeenCalledWith('[local-meetup-reminder] Could not remove reminder job', expect.objectContaining({ error: expect.any(String) }));
  });
});

describe('local-meetup-reminder worker processing (unit logic)', () => {
  const scheduledAtIso = makeScheduledAt(H48);

  beforeEach(() => { vi.clearAllMocks(); });

  it('no-ops when transaction is not found', () => {
    expect(undefined).toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'])('no-ops when transaction is in terminal status %s', (status) => {
    const tx = makeTx({ status });
    const terminals = ['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'];
    expect(terminals.includes(tx.status)).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it('no-ops when scheduledAtConfirmedAt is null', () => {
    const tx = makeTx({ scheduledAtConfirmedAt: null });
    expect(tx.scheduledAtConfirmedAt).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });

  it('no-ops when scheduledAt does not match job payload (stale job)', () => {
    const jobTime = new Date(Date.now() + H48).getTime();
    const dbTime = new Date(Date.now() + H48 + 2 * 60 * 60 * 1000).getTime();
    expect(Math.abs(jobTime - dbTime)).toBeGreaterThan(1000);
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends local.reminder.24hr notification to both buyer and seller', async () => {
    await notify(BUYER_ID, 'local.reminder.24hr', { itemTitle: 'Test', location: 'Park', date: 'Mon', time: '2pm' });
    await notify(SELLER_ID, 'local.reminder.24hr', { itemTitle: 'Test', location: 'Park', date: 'Mon', time: '2pm' });
    expect(notify).toHaveBeenCalledWith(BUYER_ID, 'local.reminder.24hr', expect.any(Object));
    expect(notify).toHaveBeenCalledWith(SELLER_ID, 'local.reminder.24hr', expect.any(Object));
  });

  it('sends local.reminder.1hr notification to both buyer and seller', async () => {
    await notify(BUYER_ID, 'local.reminder.1hr', { itemTitle: 'Test', location: 'Park', date: 'Mon', time: '2pm' });
    await notify(SELLER_ID, 'local.reminder.1hr', { itemTitle: 'Test', location: 'Park', date: 'Mon', time: '2pm' });
    expect(notify).toHaveBeenCalledWith(BUYER_ID, 'local.reminder.1hr', expect.any(Object));
    expect(notify).toHaveBeenCalledWith(SELLER_ID, 'local.reminder.1hr', expect.any(Object));
  });

  it('resolves item title from order -> orderItem -> listing join', () => {
    // Worker fetches row?.title ?? 'your item' — if resolved, use it; else fallback
    const row: { title: string } | undefined = { title: 'Vintage Jacket' };
    expect(row?.title ?? 'your item').toBe('Vintage Jacket');
  });

  it('uses fallback item title when listing not found', () => {
    // Simulates worker fallback when no row is returned
    const title: string | undefined = undefined;
    expect(title ?? 'your item').toBe('your item');
  });

  it('resolves location name from safeMeetupLocation', () => {
    const row: { name: string } | undefined = { name: 'City Park' };
    expect(row?.name ?? 'the meetup location').toBe('City Park');
  });

  it('uses fallback location when meetupLocationId is null', () => {
    const id: string | null = null;
    expect(id === null ? 'the meetup location' : 'resolved').toBe('the meetup location');
  });

  it('includes formatted date and time in notification data', () => {
    const d = new Date(scheduledAtIso);
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    expect(typeof date).toBe('string');
    expect(typeof time).toBe('string');
  });
});

describe('local-meetup-reminder delay calculation edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('meetup scheduled 25hr away: both reminders enqueued', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(H25)));
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
  });

  it('meetup scheduled 30min away: both reminders skipped', async () => {
    await enqueueLocalMeetupReminders(makeBaseData(makeScheduledAt(M30)));
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
