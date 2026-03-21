import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', hasAutomation: 'has_automation' },
  automationSetting: { sellerId: 'seller_id', poshShareEnabled: 'posh_share_enabled' },
  crosslisterAccount: { sellerId: 'seller_id', channel: 'channel', status: 'account_status', id: 'id' },
  crossJob: { sellerId: 'seller_id', payload: 'payload', createdAt: 'created_at', id: 'id', idempotencyKey: 'idempotency_key' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(vi.fn((s: TemplateStringsArray) => s[0]), { raw: vi.fn() }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/crosslister/services/automation-meter', () => ({
  canPerformAutomationAction: vi.fn(),
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));
vi.mock('../automation-circuit-breaker', () => ({
  canPerformAutomation: vi.fn(),
}));

import { db } from '@twicely/db';
import { canPerformAutomationAction } from '@twicely/crosslister/services/automation-meter';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { canPerformAutomation } from '../automation-circuit-breaker';
import { runPoshFollowEngine } from '../posh-follow-engine';

const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockCanPerform = vi.mocked(canPerformAutomationAction);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockCanPerformAutomation = vi.mocked(canPerformAutomation);

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain as unknown as ReturnType<typeof db.select>;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.insert>;
}

beforeEach(() => {
  vi.resetAllMocks();
  // Default: platform enabled, circuit ok, daily limit 50
  mockGetPlatformSetting.mockImplementation((key: string, defaultValue: unknown) => {
    if (key === 'automation.poshmark.enabled') return Promise.resolve(true);
    if (key === 'automation.poshmark.dailyFollowLimit') return Promise.resolve(50);
    return Promise.resolve(defaultValue);
  });
  mockCanPerformAutomation.mockResolvedValue(true);
});

describe('runPoshFollowEngine', () => {
  it('finds eligible sellers and creates follow jobs', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      // poshmark account
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }]))
      // today count
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runPoshFollowEngine();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('skips when automation.poshmark.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'automation.poshmark.enabled') return Promise.resolve(false);
      return Promise.resolve(defaultValue);
    });

    await runPoshFollowEngine();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('skips seller without active Poshmark account', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([])); // no poshmark account

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });

    await runPoshFollowEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips seller paused by circuit breaker', async () => {
    mockCanPerformAutomation.mockResolvedValue(false);

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }])); // has account

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });

    await runPoshFollowEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips seller at action limit', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }]));

    mockCanPerform.mockResolvedValue({ allowed: false, used: 2000, limit: 2000, remaining: 0 });

    await runPoshFollowEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('respects daily follow limit', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'automation.poshmark.enabled') return Promise.resolve(true);
      if (key === 'automation.poshmark.dailyFollowLimit') return Promise.resolve(5);
      return Promise.resolve(defaultValue);
    });

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }]))
      // today count = 5 (already at daily limit)
      .mockReturnValueOnce(makeChain([{ total: 5 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });

    await runPoshFollowEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates jobs with jobType=SYNC and automationEngine=POSH_FOLLOW', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runPoshFollowEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'SYNC',
        priority: 700,
        payload: expect.objectContaining({ automationEngine: 'POSH_FOLLOW', channel: 'POSHMARK' }),
      })
    );
  });

  it('creates jobs with maxAttempts=2', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1' }]))
      .mockReturnValueOnce(makeChain([{ id: 'acc1' }]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runPoshFollowEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 2 })
    );
  });
});
