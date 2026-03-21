import { describe, it, expect } from 'vitest';
import {
  createCollectionSchema,
  updateCollectionSchema,
  deleteCollectionSchema,
} from '../curated-collections';

// ─── CUID2 test constants ──────────────────────────────────────────────────────

const COLL_ID = 'cm1collection0000000000a';

// ─── createCollectionSchema ───────────────────────────────────────────────────

describe('createCollectionSchema', () => {
  it('accepts minimal valid input (title only)', () => {
    const result = createCollectionSchema.safeParse({ title: 'Summer Picks' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it('accepts full valid input', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Fall Fashion',
      description: 'Best fall styles',
      coverImageUrl: 'https://cdn.twicely.com/cover.jpg',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.000Z',
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = createCollectionSchema.safeParse({ sortOrder: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = createCollectionSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 200 chars', () => {
    const result = createCollectionSchema.safeParse({ title: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts title at exactly 200 chars', () => {
    const result = createCollectionSchema.safeParse({ title: 'A'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects description exceeding 1000 chars', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      description: 'A'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid coverImageUrl (not a URL)', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      coverImageUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative sortOrder', () => {
    const result = createCollectionSchema.safeParse({ title: 'Test', sortOrder: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects float sortOrder', () => {
    const result = createCollectionSchema.safeParse({ title: 'Test', sortOrder: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      isPublished: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects slug field (auto-generated, not an input)', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      slug: 'test-slug',
    });
    expect(result.success).toBe(false);
  });

  it('rejects curatedBy field (from session, not input)', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      curatedBy: 'staff-001',
    });
    expect(result.success).toBe(false);
  });
});

// ─── updateCollectionSchema ───────────────────────────────────────────────────

describe('updateCollectionSchema', () => {
  it('accepts collectionId only (all fields optional)', () => {
    const result = updateCollectionSchema.safeParse({ collectionId: COLL_ID });
    expect(result.success).toBe(true);
  });

  it('accepts full update payload', () => {
    const result = updateCollectionSchema.safeParse({
      collectionId: COLL_ID,
      title: 'New Title',
      description: 'Updated description',
      coverImageUrl: 'https://cdn.twicely.com/new.jpg',
      isPublished: true,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.000Z',
      sortOrder: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing collectionId', () => {
    const result = updateCollectionSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(false);
  });

  it('rejects empty collectionId', () => {
    const result = updateCollectionSchema.safeParse({ collectionId: '' });
    expect(result.success).toBe(false);
  });

  it('accepts null description (clearing the field)', () => {
    const result = updateCollectionSchema.safeParse({
      collectionId: COLL_ID,
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null coverImageUrl (clearing the field)', () => {
    const result = updateCollectionSchema.safeParse({
      collectionId: COLL_ID,
      coverImageUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = updateCollectionSchema.safeParse({
      collectionId: COLL_ID,
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects isPublished in createCollectionSchema (create has no isPublished)', () => {
    const result = createCollectionSchema.safeParse({
      title: 'Test',
      isPublished: false,
    });
    expect(result.success).toBe(false);
  });
});

// ─── deleteCollectionSchema ───────────────────────────────────────────────────

describe('deleteCollectionSchema', () => {
  it('accepts valid collectionId', () => {
    const result = deleteCollectionSchema.safeParse({ collectionId: COLL_ID });
    expect(result.success).toBe(true);
  });

  it('rejects missing collectionId', () => {
    const result = deleteCollectionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty collectionId', () => {
    const result = deleteCollectionSchema.safeParse({ collectionId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = deleteCollectionSchema.safeParse({ collectionId: COLL_ID, title: 'oops' });
    expect(result.success).toBe(false);
  });
});
