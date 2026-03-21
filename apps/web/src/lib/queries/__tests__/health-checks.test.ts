/**
 * Health Checks Query Tests (I11)
 * Covers getProviderInstanceById and getProviderHealthLogs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProviderInstanceById,
  getProviderHealthLogs,
} from '../health-checks';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  providerInstance: {
    id: 'id', name: 'name', displayName: 'display_name',
    status: 'status', priority: 'priority', configJson: 'config_json',
    lastHealthStatus: 'last_health_status', lastHealthCheckAt: 'last_health_check_at',
    lastHealthLatencyMs: 'last_health_latency_ms', lastHealthError: 'last_health_error',
    createdAt: 'created_at', updatedAt: 'updated_at', adapterId: 'adapter_id',
  },
  providerAdapter: {
    id: 'id', name: 'name', serviceType: 'service_type',
  },
  providerHealthLog: {
    id: 'id', instanceId: 'instance_id', status: 'status',
    latencyMs: 'latency_ms', errorMessage: 'error_message',
    detailsJson: 'details_json', checkedAt: 'checked_at',
  },
}));

vi.mock('@/lib/monitoring/types', () => ({}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc' })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T10:00:00Z');

function makeInstanceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pi-001',
    name: 'stripe-main',
    displayName: 'Stripe Main',
    status: 'ACTIVE',
    priority: 100,
    configJson: {},
    lastHealthStatus: 'HEALTHY',
    lastHealthCheckAt: NOW,
    lastHealthLatencyMs: 120,
    lastHealthError: null,
    createdAt: NOW,
    updatedAt: NOW,
    adapterId: 'pa-001',
    adapterName: 'Stripe',
    adapterServiceType: 'PAYMENT',
    ...overrides,
  };
}

function makeLogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'phl-001',
    instanceId: 'pi-001',
    status: 'HEALTHY',
    latencyMs: 120,
    errorMessage: null,
    detailsJson: {},
    checkedAt: NOW,
    ...overrides,
  };
}

function makeJoinChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// ─── getProviderInstanceById ──────────────────────────────────────────────────

describe('getProviderInstanceById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped instance when found', async () => {
    const row = makeInstanceRow();
    mockDbSelect.mockReturnValue(makeJoinChain([row]));

    const result = await getProviderInstanceById('pi-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('pi-001');
    expect(result?.displayName).toBe('Stripe Main');
    expect(result?.status).toBe('ACTIVE');
    expect(result?.adapterName).toBe('Stripe');
    expect(result?.adapterServiceType).toBe('PAYMENT');
  });

  it('returns null when instance not found', async () => {
    mockDbSelect.mockReturnValue(makeJoinChain([]));

    const result = await getProviderInstanceById('nonexistent');

    expect(result).toBeNull();
  });

  it('maps null nullable fields correctly', async () => {
    const row = makeInstanceRow({
      lastHealthStatus: null,
      lastHealthCheckAt: null,
      lastHealthLatencyMs: null,
      lastHealthError: null,
    });
    mockDbSelect.mockReturnValue(makeJoinChain([row]));

    const result = await getProviderInstanceById('pi-001');

    expect(result?.lastHealthStatus).toBeNull();
    expect(result?.lastHealthCheckAt).toBeNull();
    expect(result?.lastHealthLatencyMs).toBeNull();
    expect(result?.lastHealthError).toBeNull();
  });
});

// ─── getProviderHealthLogs ────────────────────────────────────────────────────

describe('getProviderHealthLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped health log rows', async () => {
    const rows = [
      makeLogRow(),
      makeLogRow({ id: 'phl-002', status: 'DEGRADED', latencyMs: 350 }),
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const result = await getProviderHealthLogs('pi-001');

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('phl-001');
    expect(result[0]?.status).toBe('HEALTHY');
    expect(result[1]?.status).toBe('DEGRADED');
  });

  it('returns empty array when no logs found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const result = await getProviderHealthLogs('pi-001');

    expect(result).toHaveLength(0);
  });

  it('maps null errorMessage and latencyMs to null', async () => {
    const row = makeLogRow({ latencyMs: null, errorMessage: null });
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const result = await getProviderHealthLogs('pi-001');

    expect(result[0]?.latencyMs).toBeNull();
    expect(result[0]?.errorMessage).toBeNull();
  });

  it('respects custom limit', async () => {
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);

    await getProviderHealthLogs('pi-001', 10);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});
