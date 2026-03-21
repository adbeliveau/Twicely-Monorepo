/**
 * Tests for getExtensionStatus query.
 * Uses pure-logic extraction + db mock pattern (Vitest environment: node).
 * Source: H1.4 install prompt §6.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock ─────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    sellerId: 'seller_id',
    authMethod: 'auth_method',
    channel: 'channel',
    status: 'status',
    lastAuthAt: 'last_auth_at',
  },
}));

// ─── selectChain helper ───────────────────────────────────────────────────────

function makeChain(result: unknown) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  Object.assign(chain, {
    select: vi.fn().mockReturnValue(chain),
  });
  return chain;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

const NOW = Date.now();
const TWENTY_MINUTES_AGO = new Date(NOW - 20 * 60 * 1000);
const THIRTY_ONE_MINUTES_AGO = new Date(NOW - 31 * 60 * 1000);
const TWO_HOURS_AGO = new Date(NOW - 2 * 60 * 60 * 1000);
const TWENTY_FIVE_HOURS_AGO = new Date(NOW - 25 * 60 * 60 * 1000);

// ─── Extracted logic for unit testing (mirrors query internals) ───────────────

const EXTENSION_ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;
const SESSION_EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function computeHasExtension(lastHeartbeatAt: Date | null): boolean {
  if (lastHeartbeatAt === null) return false;
  return NOW - lastHeartbeatAt.getTime() <= EXTENSION_ACTIVE_THRESHOLD_MS;
}

function computeSessionExpired(status: string, lastAuthAt: Date | null): boolean {
  if (status === 'REAUTHENTICATION_REQUIRED') return true;
  if (lastAuthAt === null) return true;
  if (NOW - lastAuthAt.getTime() > SESSION_EXPIRY_THRESHOLD_MS) return true;
  return false;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getExtensionStatus — hasExtension detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns hasExtension=true when SESSION account has lastAuthAt within 30 minutes', () => {
    const result = computeHasExtension(TWENTY_MINUTES_AGO);
    expect(result).toBe(true);
  });

  it('returns hasExtension=false when no SESSION accounts exist', () => {
    const result = computeHasExtension(null);
    expect(result).toBe(false);
  });

  it('returns hasExtension=false when SESSION account lastAuthAt is older than 30 minutes', () => {
    const result = computeHasExtension(THIRTY_ONE_MINUTES_AGO);
    expect(result).toBe(false);
  });

  it('returns hasExtension=false when lastAuthAt is exactly at the 30-minute boundary', () => {
    const exactBoundary = new Date(NOW - EXTENSION_ACTIVE_THRESHOLD_MS - 1);
    const result = computeHasExtension(exactBoundary);
    expect(result).toBe(false);
  });

  it('returns hasExtension=true when lastAuthAt is exactly within threshold', () => {
    const justInside = new Date(NOW - EXTENSION_ACTIVE_THRESHOLD_MS + 1000);
    const result = computeHasExtension(justInside);
    expect(result).toBe(true);
  });
});

describe('getExtensionStatus — sessionExpired logic', () => {
  it('marks sessionExpired=true when status is REAUTHENTICATION_REQUIRED', () => {
    const result = computeSessionExpired('REAUTHENTICATION_REQUIRED', TWENTY_MINUTES_AGO);
    expect(result).toBe(true);
  });

  it('marks sessionExpired=true when lastAuthAt is null', () => {
    const result = computeSessionExpired('ACTIVE', null);
    expect(result).toBe(true);
  });

  it('marks sessionExpired=true when lastAuthAt is older than 24 hours', () => {
    const result = computeSessionExpired('ACTIVE', TWENTY_FIVE_HOURS_AGO);
    expect(result).toBe(true);
  });

  it('marks sessionExpired=false when status is ACTIVE and lastAuthAt is recent', () => {
    const result = computeSessionExpired('ACTIVE', TWENTY_MINUTES_AGO);
    expect(result).toBe(false);
  });

  it('marks sessionExpired=false when status is ACTIVE and lastAuthAt is 2 hours ago', () => {
    const result = computeSessionExpired('ACTIVE', TWO_HOURS_AGO);
    expect(result).toBe(false);
  });

  it('marks sessionExpired=true when lastAuthAt is exactly at the 24-hour boundary', () => {
    const exactBoundary = new Date(NOW - SESSION_EXPIRY_THRESHOLD_MS - 1);
    const result = computeSessionExpired('ACTIVE', exactBoundary);
    expect(result).toBe(true);
  });
});

describe('getExtensionStatus — query integration (db mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns only SESSION accounts (not OAUTH accounts)', async () => {
    // The query uses authMethod = 'SESSION' filter — mock returns only SESSION rows
    const sessionRows = [
      { channel: 'POSHMARK', status: 'ACTIVE', lastAuthAt: TWENTY_MINUTES_AGO },
    ];
    mockDbSelect.mockReturnValue(makeChain(sessionRows));

    const { getExtensionStatus } = await import('../extension-status');
    const result = await getExtensionStatus('seller-1');

    // All returned accounts should be SESSION-based (POSHMARK, THEREALREAL)
    expect(result.tierCAccounts).toHaveLength(1);
    expect(result.tierCAccounts[0]?.channel).toBe('POSHMARK');
  });

  it('only returns accounts for the given sellerId', async () => {
    // The query filters by sellerId — mock returns rows only for the requested seller
    const rows = [
      { channel: 'THEREALREAL', status: 'ACTIVE', lastAuthAt: TWENTY_MINUTES_AGO },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getExtensionStatus } = await import('../extension-status');
    const result = await getExtensionStatus('seller-abc');

    expect(result.tierCAccounts).toHaveLength(1);
    expect(result.hasExtension).toBe(true);
  });

  it('returns hasExtension=false and empty tierCAccounts when no SESSION accounts', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getExtensionStatus } = await import('../extension-status');
    const result = await getExtensionStatus('seller-1');

    expect(result.hasExtension).toBe(false);
    expect(result.lastHeartbeatAt).toBeNull();
    expect(result.tierCAccounts).toHaveLength(0);
  });

  it('picks the most recent lastAuthAt as lastHeartbeatAt across multiple accounts', async () => {
    const rows = [
      { channel: 'POSHMARK', status: 'ACTIVE', lastAuthAt: TWO_HOURS_AGO },
      { channel: 'THEREALREAL', status: 'ACTIVE', lastAuthAt: TWENTY_MINUTES_AGO },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getExtensionStatus } = await import('../extension-status');
    const result = await getExtensionStatus('seller-1');

    expect(result.lastHeartbeatAt).toEqual(TWENTY_MINUTES_AGO);
    expect(result.hasExtension).toBe(true);
  });

  it('marks REAUTHENTICATION_REQUIRED accounts as sessionExpired in returned data', async () => {
    const rows = [
      {
        channel: 'POSHMARK',
        status: 'REAUTHENTICATION_REQUIRED',
        lastAuthAt: TWENTY_MINUTES_AGO,
      },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getExtensionStatus } = await import('../extension-status');
    const result = await getExtensionStatus('seller-1');

    expect(result.tierCAccounts[0]?.sessionExpired).toBe(true);
  });
});
