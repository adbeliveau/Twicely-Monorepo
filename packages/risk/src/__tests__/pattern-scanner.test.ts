import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockRecordRiskSignal } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockRecordRiskSignal = vi.fn().mockResolvedValue({ id: 'scan_sig' });
  return { mockSelect, mockRecordRiskSignal };
});

function createSelectChain(data: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValue(data),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
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
  db: {
    select: mockSelect,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{}]),
      }),
    }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  riskSignal: { id: 'id', userId: 'user_id', signalType: 'signal_type', resolved: 'resolved', occurredAt: 'occurred_at' },
  riskScore: {},
  riskThreshold: {},
  riskAction: {},
  accountSecurityEvent: { id: 'id', userId: 'user_id', eventType: 'event_type', ipAddress: 'ip_address', success: 'success', occurredAt: 'occurred_at' },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../signals', () => ({
  recordRiskSignal: (...args: unknown[]) => mockRecordRiskSignal(...args),
  countRecentSignals: vi.fn().mockResolvedValue(0),
}));

import { scanSecurityEventPatterns } from '../pattern-scanner';

describe('pattern-scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChainQueue = [];
    mockRecordRiskSignal.mockResolvedValue({ id: 'scan_sig' });
  });

  it('returns zero counts when no patterns detected', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([]));

    const result = await scanSecurityEventPatterns();
    expect(result.ipVelocitySignals).toBe(0);
    expect(result.paymentFailureSignals).toBe(0);
  });

  it('generates IP_VELOCITY signals for multi-user IP failures', async () => {
    selectChainQueue.push(createSelectChain([
      { ipAddress: '10.0.0.1', failureCount: 5, userCount: 2 },
    ]));
    selectChainQueue.push(createSelectChain([
      { userId: 'user_a' },
      { userId: 'user_b' },
    ]));
    selectChainQueue.push(createSelectChain([]));

    const result = await scanSecurityEventPatterns();
    expect(result.ipVelocitySignals).toBe(2);
    expect(mockRecordRiskSignal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_a',
      signalType: 'ip_velocity',
      source: 'pattern-scanner',
    }));
    expect(mockRecordRiskSignal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_b',
      signalType: 'ip_velocity',
      source: 'pattern-scanner',
    }));
  });

  it('skips single-user IP failures (only flags multi-user)', async () => {
    selectChainQueue.push(createSelectChain([
      { ipAddress: '10.0.0.1', failureCount: 10, userCount: 1 },
    ]));
    selectChainQueue.push(createSelectChain([]));

    const result = await scanSecurityEventPatterns();
    expect(result.ipVelocitySignals).toBe(0);
  });

  it('generates PAYMENT_FAILURE_RATE signals for excessive failures', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([
      { userId: 'user_c', failureCount: 6 },
    ]));

    const result = await scanSecurityEventPatterns();
    expect(result.paymentFailureSignals).toBe(1);
    expect(mockRecordRiskSignal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_c',
      signalType: 'payment_failure_rate',
      source: 'pattern-scanner',
    }));
  });

  it('does not generate payment signal below threshold', async () => {
    selectChainQueue.push(createSelectChain([]));
    selectChainQueue.push(createSelectChain([
      { userId: 'user_d', failureCount: 3 },
    ]));

    const result = await scanSecurityEventPatterns();
    expect(result.paymentFailureSignals).toBe(0);
  });

  it('handles errors gracefully without crashing', async () => {
    const errorChain = createSelectChain([]);
    errorChain.groupBy.mockRejectedValue(new Error('DB down'));
    selectChainQueue.push(errorChain);
    const errorChain2 = createSelectChain([]);
    errorChain2.groupBy.mockRejectedValue(new Error('DB down'));
    selectChainQueue.push(errorChain2);

    const result = await scanSecurityEventPatterns();
    expect(result.ipVelocitySignals).toBe(0);
    expect(result.paymentFailureSignals).toBe(0);
  });
});
