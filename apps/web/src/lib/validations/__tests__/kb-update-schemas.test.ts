import { describe, it, expect } from 'vitest';
import {
  updateKbArticleSchema,
  updateKbCategorySchema,
  kbSearchSchema,
} from '@/lib/validations/helpdesk';

// Valid cuid2 IDs
const ARTICLE_ID = 'cljd4bvd00001wjh07mcy26y';
const CATEGORY_ID = 'cljd4bvd00002wjh07mcy26z';

describe('updateKbArticleSchema', () => {
  const VALID_UPDATE = {
    articleId: ARTICLE_ID,
    title: 'Updated Title',
  };

  it('accepts valid update with articleId and title', () => {
    expect(updateKbArticleSchema.safeParse(VALID_UPDATE).success).toBe(true);
  });

  it('rejects missing articleId', () => {
    expect(updateKbArticleSchema.safeParse({ title: 'No ID' }).success).toBe(false);
  });

  it('rejects bad slug format (uppercase)', () => {
    expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID, slug: 'Bad-Slug' }).success).toBe(false);
  });

  it('accepts partial update with only title', () => {
    expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID, title: 'Just Title' }).success).toBe(true);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID, unknownField: 'bad' }).success).toBe(false);
  });

  it('accepts all valid audience values', () => {
    const audiences = ['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY'] as const;
    for (const audience of audiences) {
      expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID, audience }).success).toBe(true);
    }
  });

  it('accepts nullable excerpt', () => {
    expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID, excerpt: null }).success).toBe(true);
  });

  it('accepts update with only articleId (all other fields optional)', () => {
    expect(updateKbArticleSchema.safeParse({ articleId: ARTICLE_ID }).success).toBe(true);
  });
});

describe('updateKbCategorySchema', () => {
  it('accepts valid update', () => {
    expect(updateKbCategorySchema.safeParse({ categoryId: CATEGORY_ID, name: 'New Name' }).success).toBe(true);
  });

  it('rejects missing categoryId', () => {
    expect(updateKbCategorySchema.safeParse({ name: 'No ID' }).success).toBe(false);
  });

  it('rejects bad slug format', () => {
    expect(updateKbCategorySchema.safeParse({ categoryId: CATEGORY_ID, slug: 'Bad Slug' }).success).toBe(false);
  });

  it('accepts valid isActive toggle', () => {
    expect(updateKbCategorySchema.safeParse({ categoryId: CATEGORY_ID, isActive: false }).success).toBe(true);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(updateKbCategorySchema.safeParse({ categoryId: CATEGORY_ID, unknownField: 'bad' }).success).toBe(false);
  });

  it('accepts nullable description', () => {
    expect(updateKbCategorySchema.safeParse({ categoryId: CATEGORY_ID, description: null }).success).toBe(true);
  });
});

describe('kbSearchSchema', () => {
  it('accepts valid search query', () => {
    expect(kbSearchSchema.safeParse({ q: 'returns policy' }).success).toBe(true);
  });

  it('rejects empty q string', () => {
    expect(kbSearchSchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('accepts optional categorySlug', () => {
    expect(kbSearchSchema.safeParse({ q: 'shipping', categorySlug: 'orders' }).success).toBe(true);
  });

  it('accepts optional limit', () => {
    expect(kbSearchSchema.safeParse({ q: 'shipping', limit: 10 }).success).toBe(true);
  });

  it('rejects limit above 50', () => {
    expect(kbSearchSchema.safeParse({ q: 'shipping', limit: 51 }).success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(kbSearchSchema.safeParse({ q: 'shipping', unknownField: 'bad' }).success).toBe(false);
  });

  it('defaults limit to 20', () => {
    const result = kbSearchSchema.safeParse({ q: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });
});
