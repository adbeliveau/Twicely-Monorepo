import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockSelect, mockInsertValues, mockUpdateWhere, mockUpdateSet } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) });
  const mockUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  return { mockInsert, mockUpdate, mockSelect, mockInsertValues, mockUpdateWhere, mockUpdateSet };
});

function createSelectChain(data: unknown[] = []) {
  const resolved = Promise.resolve(data);
  const chain: Record<string, unknown> & { then: (typeof resolved)['then'] } = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    orderBy: vi.fn().mockReturnThis(),
    then: resolved.then.bind(resolved),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

let selectChainQueue: ReturnType<typeof createSelectChain>[] = [];

mockSelect.mockImplementation(() => {
  if (selectChainQueue.length > 0) {
    return selectChainQueue.shift()!;
  }
  return createSelectChain([]);
});

vi.mock('@twicely/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  riskSignal: { id: 'id', userId: 'user_id', signalType: 'signal_type', resolved: 'resolved', occurredAt: 'occurred_at', score: 'score', severity: 'severity', metaJson: 'meta_json', source: 'source', sellerId: 'seller_id' },
  riskScore: { userId: 'user_id', compositeScore: 'composite_score', lastComputedAt: 'last_computed_at' },
  riskThreshold: { action: 'action' },
  riskAction: {},
  accountSecurityEvent: {},
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { computeRiskScore } from '../scoring';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const now = new Date();
const recentTime = new Date(now.getTime() - 60 * 1000);

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig_1', userId: 'user_1', sellerId: null, signalType: 'ip_velocity',
    score: 15, severity: 'LOW', metaJson: {}, source: 'system',
    resolved: false, occurredAt: recentTime, createdAt: recentTime,
    ...overrides,
  };
}

describe('scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChainQueue = [];
    mockInsertValues.mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue([]);
  });

  it('returns score 0 and allow when no signals exist', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(0);
    expect(result.severity).toBe('LOW');
    expect(result.recommendation).toBe('allow');
  });

  it('sums signals to correct score with MEDIUM severity', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([makeSignal({ score: 25 }), makeSignal({ id: 'sig_2', score: 25 })]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(50);
    expect(result.severity).toBe('MEDIUM');
    expect(result.recommendation).toBe('warn');
  });

  it('sums signals to HIGH severity with step_up recommendation', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([makeSignal({ score: 36 }), makeSignal({ id: 'sig_2', score: 36 })]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(72);
    expect(result.severity).toBe('HIGH');
    expect(result.recommendation).toBe('step_up');
  });

  it('caps score at 100 with CRITICAL severity and block recommendation', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([makeSignal({ score: 80 }), makeSignal({ id: 'sig_2', score: 70 })]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(100);
    expect(result.severity).toBe('CRITICAL');
    expect(result.recommendation).toBe('block');
  });

  it('uses custom threshold when available', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([makeSignal({ score: 45 })]));
    selectChainQueue.push(createSelectChain([{ action: 'order_placement', warnAt: 20, stepUpAt: 40, blockAt: 60, isActive: true }]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(45);
    expect(result.recommendation).toBe('step_up');
  });

  it('excludes resolved signals (query filters resolved=false)', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(0);
    expect(result.signalCount).toBe(0);
  });

  it('returns cached score within cacheMinutes', async () => {
    const cached = {
      userId: 'user_1', buyerScore: 40, sellerScore: 10, compositeScore: 50,
      severity: 'MEDIUM', signalCount: 3, lastSignalAt: recentTime, lastComputedAt: new Date(),
    };
    selectChainQueue.push(createSelectChain([cached]));
    selectChainQueue.push(createSelectChain([]));

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(50);
    expect(result.severity).toBe('MEDIUM');
  });

  it('returns allow with score 0 when kill switch is disabled', async () => {
    vi.mocked(getPlatformSetting).mockImplementation((key: string, defaultVal: unknown) => {
      if (key === 'risk.enabled') return Promise.resolve(false);
      return Promise.resolve(defaultVal);
    });

    const result = await computeRiskScore({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(0);
    expect(result.recommendation).toBe('allow');
    expect(result.signals).toHaveLength(0);
  });
});
