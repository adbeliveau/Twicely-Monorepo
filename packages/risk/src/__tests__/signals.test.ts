import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const { mockInsert, mockUpdate, mockSelect, mockInsertReturning, mockInsertValues, mockUpdateSet } = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  return { mockInsert, mockUpdate, mockSelect, mockInsertReturning, mockInsertValues, mockUpdateSet };
});

const mockFromChain = {
  where: vi.fn().mockResolvedValue([]),
};
const mockSelectFrom = vi.fn().mockReturnValue(mockFromChain);
mockSelect.mockReturnValue({ from: mockSelectFrom });

vi.mock('@twicely/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  riskSignal: { id: 'id', userId: 'user_id', signalType: 'signal_type', resolved: 'resolved', occurredAt: 'occurred_at' },
  riskScore: {},
  riskThreshold: {},
  riskAction: {},
  accountSecurityEvent: {},
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { recordRiskSignal, resolveRiskSignal, getUnresolvedSignals } from '../signals';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

function makeSignalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig_1',
    userId: 'user_1',
    sellerId: null,
    signalType: 'ip_velocity',
    score: 15,
    severity: 'LOW',
    metaJson: {},
    source: 'system',
    resolved: false,
    resolvedAt: null,
    resolvedByStaffId: null,
    resolvedReason: null,
    occurredAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([makeSignalRow()]);
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  describe('recordRiskSignal', () => {
    it('records a signal with default base score', async () => {
      const result = await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity' });
      expect(result.score).toBe(15);
      expect(result.severity).toBe('LOW');
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user_1', signalType: 'ip_velocity', score: 15, severity: 'LOW', source: 'system' })
      );
    });

    it('applies scoreMultiplier and caps at 100', async () => {
      mockInsertReturning.mockResolvedValue([makeSignalRow({ id: 'sig_2', signalType: 'shill_bidding', score: 100, severity: 'CRITICAL' })]);
      const result = await recordRiskSignal({ userId: 'user_1', signalType: 'shill_bidding', scoreMultiplier: 3 });
      expect(result.score).toBe(100);
      expect(result.severity).toBe('CRITICAL');
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ score: 100, severity: 'CRITICAL' }));
    });

    it('reads platform_settings for base score override', async () => {
      vi.mocked(getPlatformSetting).mockResolvedValueOnce(50);
      mockInsertReturning.mockResolvedValue([makeSignalRow({ id: 'sig_3', score: 50, severity: 'MEDIUM' })]);
      const result = await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity' });
      expect(getPlatformSetting).toHaveBeenCalledWith('risk.signal.ipVelocity.baseScore', 15);
      expect(result.score).toBe(50);
    });

    it('uses fallback score 10 for unknown signal type', async () => {
      mockInsertReturning.mockResolvedValue([makeSignalRow({ id: 'sig_4', signalType: 'unknown_type', score: 10 })]);
      const result = await recordRiskSignal({ userId: 'user_1', signalType: 'unknown_type' as 'ip_velocity' });
      expect(result.score).toBe(10);
    });

    it('sets source field to provided value', async () => {
      mockInsertReturning.mockResolvedValue([makeSignalRow({ source: 'affiliate-fraud-scan' })]);
      await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity', source: 'affiliate-fraud-scan' });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ source: 'affiliate-fraud-scan' }));
    });

    it('allows duplicate signals for same user (append-only)', async () => {
      await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity' });
      await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity' });
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('passes meta as metaJson', async () => {
      const meta = { reason: 'test', count: 5 };
      await recordRiskSignal({ userId: 'user_1', signalType: 'ip_velocity', meta });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ metaJson: meta }));
    });

    it('includes sellerId when provided', async () => {
      await recordRiskSignal({ userId: 'user_1', sellerId: 'seller_1', signalType: 'unusual_volume' });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ sellerId: 'seller_1' }));
    });
  });

  describe('resolveRiskSignal', () => {
    it('marks signal as resolved with staff ID and reason', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'sig_1', resolved: true, resolvedAt: new Date(), resolvedByStaffId: 'staff_1', resolvedReason: 'False positive' }]),
      });
      mockUpdateSet.mockReturnValue({ where: mockWhere });

      const result = await resolveRiskSignal('sig_1', 'staff_1', 'False positive');
      expect(result).toBeTruthy();
      expect(result?.resolvedByStaffId).toBe('staff_1');
      expect(result?.resolvedReason).toBe('False positive');
    });

    it('returns null when signal not found', async () => {
      const mockWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
      mockUpdateSet.mockReturnValue({ where: mockWhere });
      const result = await resolveRiskSignal('nonexistent', 'staff_1');
      expect(result).toBeNull();
    });
  });

  describe('getUnresolvedSignals', () => {
    it('queries signals within the specified window', async () => {
      await getUnresolvedSignals('user_1', 48);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockSelectFrom).toHaveBeenCalled();
      expect(mockFromChain.where).toHaveBeenCalled();
    });
  });
});
