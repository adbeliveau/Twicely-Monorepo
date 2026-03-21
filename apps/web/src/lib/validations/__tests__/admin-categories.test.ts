import { describe, it, expect } from 'vitest';
import {
  createCategorySchema,
  updateCategorySchema,
  createAttributeSchemaInput,
} from '../admin-categories';

// ─── createCategorySchema ──────────────────────────────────────────────────────

describe('createCategorySchema', () => {
  const validFull = {
    name: 'Electronics',
    slug: 'electronics',
    feeBucket: 'ELECTRONICS' as const,
    sortOrder: 0,
    isActive: true,
    isLeaf: false,
    parentId: null,
    description: 'All electronics',
    icon: 'Monitor',
    metaTitle: 'Electronics',
    metaDescription: 'Shop electronics',
  };

  it('accepts valid input with all fields', () => {
    const result = createCategorySchema.safeParse(validFull);
    expect(result.success).toBe(true);
  });

  it('accepts minimal valid input (name + slug + feeBucket only)', () => {
    const result = createCategorySchema.safeParse({
      name: 'Shoes',
      slug: 'shoes',
      feeBucket: 'APPAREL_ACCESSORIES',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name: _, ...rest } = validFull;
    const result = createCategorySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug (uppercase characters)', () => {
    const result = createCategorySchema.safeParse({ ...validFull, slug: 'Electronics' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug (spaces)', () => {
    const result = createCategorySchema.safeParse({ ...validFull, slug: 'some slug' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = createCategorySchema.safeParse({ ...validFull, unknownKey: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid feeBucket value', () => {
    const result = createCategorySchema.safeParse({ ...validFull, feeBucket: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 characters', () => {
    const result = createCategorySchema.safeParse({ ...validFull, name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

// ─── updateCategorySchema ──────────────────────────────────────────────────────

describe('updateCategorySchema', () => {
  it('requires id field', () => {
    const result = updateCategorySchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(false);
  });

  it('accepts partial updates (only name)', () => {
    const result = updateCategorySchema.safeParse({ id: 'cat-001', name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = updateCategorySchema.safeParse({ id: 'cat-001', badField: 'x' });
    expect(result.success).toBe(false);
  });
});

// ─── createAttributeSchemaInput ───────────────────────────────────────────────

describe('createAttributeSchemaInput', () => {
  const validAttr = {
    categoryId: 'cat-001',
    name: 'brand',
    label: 'Brand',
    fieldType: 'text' as const,
    isRequired: false,
    isRecommended: false,
    showInFilters: false,
    showInListing: true,
    optionsJson: [],
    validationJson: {},
    sortOrder: 0,
  };

  it('accepts valid input', () => {
    const result = createAttributeSchemaInput.safeParse(validAttr);
    expect(result.success).toBe(true);
  });

  it('rejects invalid fieldType', () => {
    const result = createAttributeSchemaInput.safeParse({ ...validAttr, fieldType: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('defaults isRequired to false', () => {
    const { isRequired: _, ...rest } = validAttr;
    const result = createAttributeSchemaInput.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isRequired).toBe(false);
  });

  it('defaults showInListing to true', () => {
    const { showInListing: _, ...rest } = validAttr;
    const result = createAttributeSchemaInput.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.showInListing).toBe(true);
  });
});
