import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'q-1' }),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'q-1' }),
  })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/jobs/shutdown-registry', () => ({
  registerShutdown: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockRegisterDeadline = vi.fn().mockResolvedValue(undefined);
const mockRegisterExpiry = vi.fn().mockResolvedValue(undefined);
const mockRegisterCron = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/jobs/shipping-quote-deadline', () => ({
  registerShippingQuoteDeadlineJob: mockRegisterDeadline,
}));

vi.mock('@twicely/jobs/expire-free-lister-tier', () => ({
  registerExpireFreeListerJob: mockRegisterExpiry,
}));

vi.mock('@twicely/jobs/cron-jobs', () => ({
  registerCronJobs: mockRegisterCron,
}));

vi.mock('@twicely/crosslister/queue/lister-worker', () => ({
  listerWorker: { on: vi.fn(), close: vi.fn() },
}));

vi.mock('@twicely/crosslister/queue/automation-worker', () => ({
  automationWorker: { on: vi.fn(), close: vi.fn() },
}));

vi.mock('@twicely/crosslister/queue/scheduler-loop', () => ({
  startSchedulerLoop: vi.fn(),
  stopSchedulerLoop: vi.fn(),
}));

vi.mock('../../polling/poll-scheduler', () => ({
  runPollSchedulerTick: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/automation-scheduler', () => ({
  runAutomationTick: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/constants', () => ({
  AUTOMATION_TICK_INTERVAL_MS: 3_600_000,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('worker-init wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calls registerShippingQuoteDeadlineJob on init', async () => {
    const { initListerWorker } = await import('../worker-init');
    initListerWorker();
    expect(mockRegisterDeadline).toHaveBeenCalledTimes(1);
  });

  it('calls registerExpireFreeListerJob on init', async () => {
    const { initListerWorker } = await import('../worker-init');
    initListerWorker();
    expect(mockRegisterExpiry).toHaveBeenCalledTimes(1);
  });

  it('calls registerCronJobs on init', async () => {
    const { initListerWorker } = await import('../worker-init');
    initListerWorker();
    expect(mockRegisterCron).toHaveBeenCalledTimes(1);
  });

  it('starts scheduler loop on init', async () => {
    const { initListerWorker } = await import('../worker-init');
    const { startSchedulerLoop } = await import('@twicely/crosslister/queue/scheduler-loop');
    initListerWorker();
    expect(startSchedulerLoop).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — second call is no-op', async () => {
    const { initListerWorker } = await import('../worker-init');
    initListerWorker();
    initListerWorker();
    // Only called once despite two init calls
    expect(mockRegisterCron).toHaveBeenCalledTimes(1);
  });
});
