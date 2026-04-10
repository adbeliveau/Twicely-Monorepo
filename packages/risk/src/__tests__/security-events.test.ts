import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockInsertReturning, mockInsertValues, mockSelect, mockRecordRiskSignal } = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn();
  mockInsert.mockReturnValue({ values: mockInsertValues });
  const mockSelect = vi.fn();
  const mockRecordRiskSignal = vi.fn().mockResolvedValue({ id: 'auto_sig' });
  return { mockInsert, mockInsertReturning, mockInsertValues, mockSelect, mockRecordRiskSignal };
});

function createSelectChain(data: unknown[] = []) {
  const resolved = Promise.resolve(data);
  const chain: Record<string, unknown> & { then: (typeof resolved)['then'] } = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: resolved.then.bind(resolved),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.groupBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
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
  db: { insert: mockInsert, select: mockSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  riskSignal: { id: 'id', userId: 'user_id', signalType: 'signal_type', resolved: 'resolved', occurredAt: 'occurred_at' },
  riskScore: {},
  riskThreshold: {},
  riskAction: {},
  accountSecurityEvent: { id: 'id', userId: 'user_id', eventType: 'event_type', ipAddress: 'ip_address', userAgent: 'user_agent', deviceId: 'device_id', location: 'location', success: 'success', metaJson: 'meta_json', occurredAt: 'occurred_at' },
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

import { recordSecurityEvent, getSecurityEvents } from '../security-events';

describe('security-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChainQueue = [];
    mockInsertReturning.mockResolvedValue([{
      id: 'evt_1', userId: 'user_1', eventType: 'login',
      ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0', deviceId: 'dev_1',
      location: 'US', success: true, metaJson: {}, occurredAt: new Date(),
    }]);
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockRecordRiskSignal.mockResolvedValue({ id: 'auto_sig' });
  });

  it('records a login success event without generating a signal', async () => {
    selectChainQueue.push(createSelectChain([{ deviceId: 'dev_1' }]));
    selectChainQueue.push(createSelectChain([{ ipAddress: '192.168.1.50' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login',
      ipAddress: '192.168.1.1',
      deviceId: 'dev_1',
      success: true,
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockRecordRiskSignal).not.toHaveBeenCalled();
  });

  it('does not generate signal for 2 login failures (below threshold)', async () => {
    mockInsertReturning.mockResolvedValue([{
      id: 'evt_2', userId: 'user_1', eventType: 'login_failure',
      ipAddress: null, userAgent: null, deviceId: null,
      location: null, success: false, metaJson: {}, occurredAt: new Date(),
    }]);

    selectChainQueue.push(createSelectChain([{ id: 'f1' }, { id: 'f2' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login_failure',
      success: false,
    });

    expect(mockRecordRiskSignal).not.toHaveBeenCalled();
  });

  it('generates LOGIN_FAILURES signal on 3+ failures in window', async () => {
    mockInsertReturning.mockResolvedValue([{
      id: 'evt_3', userId: 'user_1', eventType: 'login_failure',
      ipAddress: null, userAgent: null, deviceId: null,
      location: null, success: false, metaJson: {}, occurredAt: new Date(),
    }]);

    selectChainQueue.push(createSelectChain([{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login_failure',
      success: false,
    });

    expect(mockRecordRiskSignal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      signalType: 'login_failures',
      source: 'security-event-auto',
    }));
  });

  it('generates DEVICE_CHANGE signal for new device', async () => {
    mockInsertReturning.mockResolvedValue([{
      id: 'evt_4', userId: 'user_1', eventType: 'login',
      ipAddress: null, userAgent: null, deviceId: 'new_dev',
      location: null, success: true, metaJson: {}, occurredAt: new Date(),
    }]);

    selectChainQueue.push(createSelectChain([{ deviceId: 'old_dev_1' }, { deviceId: 'old_dev_2' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login',
      deviceId: 'new_dev',
      success: true,
    });

    expect(mockRecordRiskSignal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      signalType: 'device_change',
    }));
  });

  it('does not generate signal for known device', async () => {
    selectChainQueue.push(createSelectChain([{ deviceId: 'dev_1' }, { deviceId: 'dev_1' }]));
    selectChainQueue.push(createSelectChain([{ ipAddress: '192.168.1.50' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login',
      ipAddress: '192.168.1.1',
      deviceId: 'dev_1',
      success: true,
    });

    expect(mockRecordRiskSignal).not.toHaveBeenCalled();
  });

  it('persists event with all fields', async () => {
    selectChainQueue.push(createSelectChain([{ deviceId: 'dev_1' }]));
    selectChainQueue.push(createSelectChain([{ ipAddress: '192.168.1.50' }]));

    await recordSecurityEvent({
      userId: 'user_1',
      eventType: 'login',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      deviceId: 'dev_1',
      location: 'US',
      success: true,
      meta: { extra: 'data' },
    });

    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      eventType: 'login',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      deviceId: 'dev_1',
      location: 'US',
      success: true,
      metaJson: { extra: 'data' },
    }));
  });
});
