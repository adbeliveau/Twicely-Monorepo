import { describe, it, expect } from 'vitest';
import {
  addCollectionItemSchema,
  removeCollectionItemSchema,
  reorderCollectionItemsSchema,
} from '../curated-collections';

// ─── CUID2 test constants ──────────────────────────────────────────────────────

const COLL_ID = 'cm1collection0000000000a';
const LIST_ID1 = 'cm1listingid0000000000a1';
const LIST_ID2 = 'cm1listingid0000000000a2';
const LIST_ID3 = 'cm1listingid0000000000a3';

// ─── addCollectionItemSchema ──────────────────────────────────────────────────

describe('addCollectionItemSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortOrder).toBe(0);
  });

  it('accepts explicit sortOrder', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
      sortOrder: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing collectionId', () => {
    const result = addCollectionItemSchema.safeParse({ listingId: LIST_ID1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing listingId', () => {
    const result = addCollectionItemSchema.safeParse({ collectionId: COLL_ID });
    expect(result.success).toBe(false);
  });

  it('rejects empty collectionId', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: '',
      listingId: LIST_ID1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty listingId', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative sortOrder', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects addedBy field (from session, not input)', () => {
    const result = addCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
      addedBy: 'staff-001',
    });
    expect(result.success).toBe(false);
  });
});

// ─── removeCollectionItemSchema ───────────────────────────────────────────────

describe('removeCollectionItemSchema', () => {
  it('accepts valid collectionId and listingId', () => {
    const result = removeCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing collectionId', () => {
    const result = removeCollectionItemSchema.safeParse({ listingId: LIST_ID1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing listingId', () => {
    const result = removeCollectionItemSchema.safeParse({ collectionId: COLL_ID });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = removeCollectionItemSchema.safeParse({
      collectionId: COLL_ID,
      listingId: LIST_ID1,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── reorderCollectionItemsSchema ────────────────────────────────────────────

describe('reorderCollectionItemsSchema', () => {
  it('accepts valid input with one item', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple items', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [
        { listingId: LIST_ID1, sortOrder: 0 },
        { listingId: LIST_ID2, sortOrder: 1 },
        { listingId: LIST_ID3, sortOrder: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items array (min 1)', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing collectionId', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item with missing sortOrder', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item with negative sortOrder', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields on outer object (strict mode)', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 0 }],
      extraField: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects item with float sortOrder', () => {
    const result = reorderCollectionItemsSchema.safeParse({
      collectionId: COLL_ID,
      items: [{ listingId: LIST_ID1, sortOrder: 1.5 }],
    });
    expect(result.success).toBe(false);
  });
});
