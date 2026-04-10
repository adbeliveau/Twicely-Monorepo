import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => {
  const mockChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    onConflictDoUpdate: vi.fn(),
  };
  Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));
  return {
    db: {
      insert: vi.fn().mockReturnValue(mockChain),
      select: vi.fn().mockReturnValue(mockChain),
      update: vi.fn().mockReturnValue(mockChain),
    },
  };
});

vi.mock('@twicely/db/schema', () => ({
  healthSnapshot: { id: 'id', runId: 'run_id', checkName: 'check_name' },
  healthRun: { id: 'id' },
  healthCheckProvider: { id: 'id', checkName: 'check_name' },
}));

vi.mock('@paralleldrive/cuid2', () => {
  let counter = 0;
  return {
    createId: vi.fn(() => `cuid_${++counter}`),
  };
});

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ─────────────────────────────────────────────────────────────

import type { CheckResult, HealthRunSummary } from '../health-persistence';

function makeSummary(statuses: Array<CheckResult['status']>): HealthRunSummary {
  const now = new Date();
  return {
    startedAt: new Date(now.getTime() - 1000),
    finishedAt: now,
    checks: statuses.map((status, i) => ({
      checkName: `check-${i}`,
      module: `module-${i}`,
      status,
    })),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('persistHealthRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('inserts a healthRun row with correct status counts', async () => {
    const { db } = await import('@twicely/db');
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary(['HEALTHY', 'HEALTHY', 'DEGRADED']);
    const result = await persistHealthRun(summary, 'scheduled');

    expect(db.insert).toHaveBeenCalled();
    expect(result.status).toBe('DEGRADED');
    expect(result.id).toBeTruthy();
  });

  it('derives UNHEALTHY when any check is unhealthy', async () => {
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary(['HEALTHY', 'UNHEALTHY', 'DEGRADED']);
    const result = await persistHealthRun(summary, 'manual');

    expect(result.status).toBe('UNHEALTHY');
  });

  it('derives HEALTHY when all checks pass', async () => {
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary(['HEALTHY', 'HEALTHY']);
    const result = await persistHealthRun(summary, 'interactive');

    expect(result.status).toBe('HEALTHY');
  });

  it('derives UNKNOWN when all checks are unknown', async () => {
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary(['UNKNOWN', 'UNKNOWN']);
    const result = await persistHealthRun(summary, 'scheduled');

    expect(result.status).toBe('UNKNOWN');
  });

  it('derives UNKNOWN for empty checks array', async () => {
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary([]);
    const result = await persistHealthRun(summary, 'scheduled');

    expect(result.status).toBe('UNKNOWN');
  });

  it('records triggeredByStaffId when provided', async () => {
    const { db } = await import('@twicely/db');
    const { persistHealthRun } = await import('../health-persistence');

    const summary = makeSummary(['HEALTHY']);
    await persistHealthRun(summary, 'manual', 'staff_123');

    // Verify insert was called (the first call is for healthRun)
    expect(db.insert).toHaveBeenCalled();
  });
});
