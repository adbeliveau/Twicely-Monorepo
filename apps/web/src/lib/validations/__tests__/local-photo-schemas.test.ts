import { describe, it, expect } from 'vitest';
import { uploadMeetupPhotosSchema, removeMeetupPhotoSchema } from '../local';

// ─── uploadMeetupPhotosSchema ─────────────────────────────────────────────────

describe('uploadMeetupPhotosSchema', () => {
  const VALID_URL_1 = 'https://cdn.twicely.com/meetup-photos/lt-001/0-1234.jpg';
  const VALID_URL_2 = 'https://cdn.twicely.com/meetup-photos/lt-001/1-1235.jpg';

  it('accepts valid input with one URL', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: [VALID_URL_1],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with up to 5 URLs', () => {
    const urls = [VALID_URL_1, VALID_URL_2,
      'https://cdn.twicely.com/p3.jpg',
      'https://cdn.twicely.com/p4.jpg',
      'https://cdn.twicely.com/p5.jpg',
    ];
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: urls,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty localTransactionId', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: '',
      photoUrls: [VALID_URL_1],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing localTransactionId', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      photoUrls: [VALID_URL_1],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty photoUrls array (min 1)', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects photoUrls array with more than 5 entries (max 5)', () => {
    const urls = Array.from({ length: 6 }, (_, i) =>
      `https://cdn.twicely.com/p${i}.jpg`
    );
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: urls,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL string in photoUrls', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: ['not-a-url'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects relative URL in photoUrls', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: ['/uploads/meetup/photo.jpg'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrls: [VALID_URL_1],
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing photoUrls field', () => {
    const result = uploadMeetupPhotosSchema.safeParse({
      localTransactionId: 'lt-abc123',
    });
    expect(result.success).toBe(false);
  });
});

// ─── removeMeetupPhotoSchema ──────────────────────────────────────────────────

describe('removeMeetupPhotoSchema', () => {
  const VALID_URL = 'https://cdn.twicely.com/meetup-photos/lt-001/0-1234.jpg';

  it('accepts valid input', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrl: VALID_URL,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty localTransactionId', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: '',
      photoUrl: VALID_URL,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing localTransactionId', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      photoUrl: VALID_URL,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL photoUrl', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects relative path as photoUrl', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrl: '/uploads/meetup/photo.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing photoUrl', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: 'lt-abc123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = removeMeetupPhotoSchema.safeParse({
      localTransactionId: 'lt-abc123',
      photoUrl: VALID_URL,
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
