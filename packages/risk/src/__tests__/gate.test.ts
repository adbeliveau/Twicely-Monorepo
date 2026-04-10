import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsertValues, mockInsert, mockComputeRiskScore } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  const mockComputeRiskScore = vi.fn();
  return { mockInsertValues, mockInsert, mockComputeRiskScore };
});

vi.mock('@twicely/db', () => ({
  db: { insert: mockInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  riskSignal: {},
  riskScore: {},
  riskThreshold: {},
  riskAction: { id: 'id', userId: 'user_id', action: 'action', recommendation: 'recommendation', scoreAtTime: 'score_at_time', outcome: 'outcome', metaJson: 'meta_json' },
  accountSecurityEvent: {},
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../scoring', () => ({
  computeRiskScore: (...args: unknown[]) => mockComputeRiskScore(...args),
}));

import { assertRiskAllowed, RiskBlockedError, StepUpRequiredError } from '../gate';

function makeScoreResult(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user_1',
    compositeScore: 0,
    buyerScore: 0,
    sellerScore: 0,
    severity: 'LOW' as const,
    signalCount: 0,
    recommendation: 'allow' as const,
    signals: [],
    ...overrides,
  };
}

describe('gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockComputeRiskScore.mockResolvedValue(makeScoreResult());
  });

  it('returns RiskScore and outcome=allowed when score is below warn', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 10, recommendation: 'allow' }));
    const result = await assertRiskAllowed({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(10);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'allowed' }));
  });

  it('returns RiskScore at warn level (advisory only)', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 40, recommendation: 'warn' }));
    const result = await assertRiskAllowed({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(40);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'allowed' }));
  });

  it('throws StepUpRequiredError at step_up level', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 70, recommendation: 'step_up' }));
    await expect(assertRiskAllowed({ userId: 'user_1', action: 'order_placement' }))
      .rejects.toThrow(StepUpRequiredError);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'step_up_failed' }));
  });

  it('returns score at step_up level with bypassStepUp=true', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 70, recommendation: 'step_up' }));
    const result = await assertRiskAllowed({ userId: 'user_1', action: 'order_placement', bypassStepUp: true });
    expect(result.compositeScore).toBe(70);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'step_up_passed' }));
  });

  it('throws RiskBlockedError at block level', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 90, recommendation: 'block' }));
    await expect(assertRiskAllowed({ userId: 'user_1', action: 'order_placement' }))
      .rejects.toThrow(RiskBlockedError);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'blocked' }));
  });

  it('error objects have correct action and score properties', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 95, recommendation: 'block' }));
    try {
      await assertRiskAllowed({ userId: 'user_1', action: 'payout_change' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RiskBlockedError);
      const blocked = err as RiskBlockedError;
      expect(blocked.score).toBe(95);
      expect(blocked.action).toBe('payout_change');
    }
  });

  it('every gate call creates a riskAction row', async () => {
    mockComputeRiskScore.mockResolvedValue(makeScoreResult({ compositeScore: 10, recommendation: 'allow' }));
    await assertRiskAllowed({ userId: 'user_1', action: 'order_placement' });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      action: 'order_placement',
    }));
  });

  it('fails OPEN when computeRiskScore throws (returns allow)', async () => {
    mockComputeRiskScore.mockRejectedValue(new Error('DB connection failed'));
    const result = await assertRiskAllowed({ userId: 'user_1', action: 'order_placement' });
    expect(result.compositeScore).toBe(0);
    expect(result.recommendation).toBe('allow');
  });
});
