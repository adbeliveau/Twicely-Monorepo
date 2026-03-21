import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbSelectDistinct = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    selectDistinct: (...args: unknown[]) => mockDbSelectDistinct(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  notificationTemplate: {
    id: 'id',
    key: 'key',
    name: 'name',
    category: 'category',
    isActive: 'is_active',
    isSystemOnly: 'is_system_only',
    channels: 'channels',
    description: 'description',
    subjectTemplate: 'subject_template',
    bodyTemplate: 'body_template',
    htmlTemplate: 'html_template',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ type: 'eq' })),
  asc: vi.fn((_col) => ({ type: 'asc' })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray) => ({ type: 'sql', raw: strings[0] })),
    { raw: vi.fn() },
  ),
}));

import {
  getAdminNotificationTemplates,
  getAdminNotificationTemplateById,
  getNotificationCategories,
} from '../admin-notifications';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeRow(key: string, category: string, isActive = true) {
  return {
    id: `tpl-${key}`,
    key,
    name: `Template ${key}`,
    description: null,
    category,
    channels: ['EMAIL'],
    isSystemOnly: false,
    isActive,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeDetailRow(key: string) {
  return {
    ...makeRow(key, 'orders'),
    subjectTemplate: 'Subject for {{key}}',
    bodyTemplate: 'Body for {{key}}',
    htmlTemplate: '<p>HTML for {{key}}</p>',
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'innerJoin', 'leftJoin'].forEach(
    (k) => {
      chain[k] = vi.fn().mockReturnValue(chain);
    },
  );
  return chain;
}

// ─── getAdminNotificationTemplates ───────────────────────────────────────────

describe('getAdminNotificationTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all templates ordered by category and name', async () => {
    const rows = [
      makeRow('offers.new', 'offers'),
      makeRow('order.confirmed', 'orders'),
      makeRow('order.shipped', 'orders'),
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const result = await getAdminNotificationTemplates();
    expect(result).toHaveLength(3);
  });

  it('filters by category when provided', async () => {
    const rows = [makeRow('order.confirmed', 'orders')];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const result = await getAdminNotificationTemplates({ category: 'orders' });
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe('orders');
  });

  it('filters by isActive when provided', async () => {
    const rows = [makeRow('order.confirmed', 'orders', true)];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const result = await getAdminNotificationTemplates({ isActive: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.isActive).toBe(true);
  });

  it('returns empty array when no templates match', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const result = await getAdminNotificationTemplates({ category: 'nonexistent' });
    expect(result).toHaveLength(0);
  });
});

// ─── getAdminNotificationTemplateById ────────────────────────────────────────

describe('getAdminNotificationTemplateById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns template with all fields when found', async () => {
    const row = makeDetailRow('order.confirmed');
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const result = await getAdminNotificationTemplateById('tpl-order.confirmed');
    expect(result).not.toBeNull();
    expect(result!.key).toBe('order.confirmed');
    expect(result!.bodyTemplate).toBe('Body for {{key}}');
    expect(result!.subjectTemplate).toBe('Subject for {{key}}');
  });

  it('returns null for non-existent ID', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const result = await getAdminNotificationTemplateById('nonexistent-id');
    expect(result).toBeNull();
  });
});

// ─── getNotificationCategories ───────────────────────────────────────────────

describe('getNotificationCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns distinct category values', async () => {
    const rows = [{ category: 'offers' }, { category: 'orders' }, { category: 'shipping' }];
    mockDbSelectDistinct.mockReturnValue(makeSelectChain(rows));

    const result = await getNotificationCategories();
    expect(result).toEqual(['offers', 'orders', 'shipping']);
  });

  it('returns empty array when no templates exist', async () => {
    mockDbSelectDistinct.mockReturnValue(makeSelectChain([]));

    const result = await getNotificationCategories();
    expect(result).toEqual([]);
  });
});
