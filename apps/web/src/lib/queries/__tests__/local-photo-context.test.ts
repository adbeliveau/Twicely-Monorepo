import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', meetupPhotoUrls: 'meetup_photo_urls', meetupPhotosAt: 'meetup_photos_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TX_ID = 'lt-ctx-001';
const PHOTO_URL_1 = 'https://cdn.twicely.com/meetup-photos/lt-001/0-1234.jpg';
const PHOTO_URL_2 = 'https://cdn.twicely.com/meetup-photos/lt-001/1-1235.jpg';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    meetupPhotoUrls: [] as string[],
    meetupPhotosAt: null as Date | null,
    ...overrides,
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── getMeetupPhotoContext ────────────────────────────────────────────────────

describe('getMeetupPhotoContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns hasPhotos: false when meetupPhotoUrls is empty', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeRow()]) as never);
    const { getMeetupPhotoContext } = await import('../local-transaction');
    const result = await getMeetupPhotoContext(TX_ID);
    expect(result).not.toBeNull();
    expect(result?.hasPhotos).toBe(false);
    expect(result?.photoUrls).toHaveLength(0);
  });

  it('returns hasPhotos: true with URLs when photos exist', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeRow({ meetupPhotoUrls: [PHOTO_URL_1, PHOTO_URL_2] })]) as never);
    const { getMeetupPhotoContext } = await import('../local-transaction');
    const result = await getMeetupPhotoContext(TX_ID);
    expect(result?.hasPhotos).toBe(true);
    expect(result?.photoUrls).toEqual([PHOTO_URL_1, PHOTO_URL_2]);
  });

  it('returns null photosAt when no photos were taken', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeRow({ meetupPhotosAt: null })]) as never);
    const { getMeetupPhotoContext } = await import('../local-transaction');
    const result = await getMeetupPhotoContext(TX_ID);
    expect(result?.photosAt).toBeNull();
  });

  it('returns photosAt timestamp when photos were taken', async () => {
    const photosAt = new Date('2026-03-12T14:30:00Z');
    mockDbSelect.mockReturnValue(makeSelectChain([makeRow({ meetupPhotoUrls: [PHOTO_URL_1], meetupPhotosAt: photosAt })]) as never);
    const { getMeetupPhotoContext } = await import('../local-transaction');
    const result = await getMeetupPhotoContext(TX_ID);
    expect(result?.photosAt).toEqual(photosAt);
  });

  it('returns null when transaction does not exist', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const { getMeetupPhotoContext } = await import('../local-transaction');
    const result = await getMeetupPhotoContext('nonexistent');
    expect(result).toBeNull();
  });
});
