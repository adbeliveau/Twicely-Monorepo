import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  crossJob: { sellerId: 'seller_id', createdAt: 'created_at', payload: 'payload' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gte: vi.fn((a, b) => ({ type: 'gte', a, b })),
  sql: Object.assign(vi.fn((s: TemplateStringsArray) => s[0]), { raw: vi.fn() }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import {
  getAutomationActionCount,
  canPerformAutomationAction,
} from '@twicely/crosslister/services/automation-meter';

const mockSelect = vi.mocked(db.select);
const mockGetSetting = vi.mocked(getPlatformSetting);

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain as unknown as ReturnType<typeof db.select>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getAutomationActionCount', () => {
  it('returns correct count for current month', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 42 }]));
    const count = await getAutomationActionCount('user1', new Date());
    expect(count).toBe(42);
  });

  it('returns 0 when no actions found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 0 }]));
    const count = await getAutomationActionCount('user1', new Date());
    expect(count).toBe(0);
  });

  it('returns 0 when query returns empty result', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));
    const count = await getAutomationActionCount('user1', new Date());
    expect(count).toBe(0);
  });
});

describe('canPerformAutomationAction', () => {
  it('returns allowed=true when under limit', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 100 }]));
    mockGetSetting.mockResolvedValue(2000);

    const result = await canPerformAutomationAction('user1');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(100);
    expect(result.limit).toBe(2000);
    expect(result.remaining).toBe(1900);
  });

  it('returns allowed=false when limit exceeded', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 2001 }]));
    mockGetSetting.mockResolvedValue(2000);

    const result = await canPerformAutomationAction('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('reads limit from platform_settings — never hardcoded', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 0 }]));
    mockGetSetting.mockResolvedValue(500); // custom limit

    const result = await canPerformAutomationAction('user1');
    expect(result.limit).toBe(500);
    expect(mockGetSetting).toHaveBeenCalledWith('automation.actionsPerMonth', 2000);
  });

  it('correctly calculates remaining actions', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 1234 }]));
    mockGetSetting.mockResolvedValue(2000);

    const result = await canPerformAutomationAction('user1');
    expect(result.remaining).toBe(766);
  });

  it('remaining is never negative when over limit', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ total: 3000 }]));
    mockGetSetting.mockResolvedValue(2000);

    const result = await canPerformAutomationAction('user1');
    expect(result.remaining).toBe(0);
    expect(result.allowed).toBe(false);
  });
});
