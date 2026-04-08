/**
 * Tests for getImportOnboardingState (G1-C).
 * Verifies account/batch/profile aggregation and channel display name mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    sellerId: 'seller_id',
    status: 'status',
    channel: 'channel',
    firstImportCompletedAt: 'first_import_completed_at',
  },
  importBatch: {
    sellerId: 'seller_id',
    status: 'status',
  },
  sellerProfile: {
    userId: 'user_id',
    listerTier: 'lister_tier',
  },
}));

// Real channel-registry needed for display name assertions
vi.mock('@twicely/crosslister/channel-registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@twicely/crosslister/channel-registry')>();
  return real;
});

// Chainable select chain that resolves when awaited
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject),
  };
  for (const k of ['from', 'where', 'limit', 'orderBy', 'offset']) {
    chain[k] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

// The query fires 3 parallel selects via Promise.all.
// mockReturnValueOnce order: accounts, batches, profileRow.
function setupMocks(
  accounts: unknown[],
  batches: unknown[],
  profile: unknown[],
) {
  mockDbSelect
    .mockReturnValueOnce(makeChain(accounts))
    .mockReturnValueOnce(makeChain(batches))
    .mockReturnValueOnce(makeChain(profile));
}

describe('getImportOnboardingState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // Test 1
  it('returns hasConnectedAccounts: false when seller has no crosslisterAccount rows', async () => {
    setupMocks([], [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-1');

    expect(result.hasConnectedAccounts).toBe(false);
    expect(result.hasActiveAccounts).toBe(false);
    expect(result.connectedChannels).toHaveLength(0);
    expect(result.availableImportChannels).toHaveLength(0);
  });

  // Test 2
  it('returns hasConnectedAccounts: true, hasActiveAccounts: true when seller has ACTIVE account', async () => {
    const accounts = [
      { status: 'ACTIVE', channel: 'EBAY', firstImportCompletedAt: null },
    ];
    setupMocks(accounts, [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-2');

    expect(result.hasConnectedAccounts).toBe(true);
    expect(result.hasActiveAccounts).toBe(true);
  });

  // Test 3
  it('returns hasActiveAccounts: false when seller only has REVOKED accounts', async () => {
    const accounts = [
      { status: 'REVOKED', channel: 'EBAY', firstImportCompletedAt: null },
      { status: 'REVOKED', channel: 'POSHMARK', firstImportCompletedAt: null },
    ];
    setupMocks(accounts, [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-3');

    expect(result.hasConnectedAccounts).toBe(true);
    expect(result.hasActiveAccounts).toBe(false);
    expect(result.connectedChannels).toHaveLength(0);
  });

  // Test 4
  it('returns hasCompletedImport: true when a COMPLETED importBatch exists', async () => {
    setupMocks([], [{ status: 'COMPLETED' }], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-4');

    expect(result.hasCompletedImport).toBe(true);
  });

  // Test 5
  it('returns hasCompletedImport: true when a PARTIALLY_COMPLETED importBatch exists', async () => {
    const batches = [
      { status: 'CREATED' },
      { status: 'PARTIALLY_COMPLETED' },
    ];
    setupMocks([], batches, []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-5');

    expect(result.hasCompletedImport).toBe(true);
  });

  // Test 6
  it('returns hasCompletedImport: false when only CREATED/FETCHING batches exist', async () => {
    const batches = [{ status: 'CREATED' }, { status: 'FETCHING' }];
    setupMocks([], batches, []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-6');

    expect(result.hasCompletedImport).toBe(false);
  });

  // Test 7
  it('returns correct connectedChannels list (display names from registry)', async () => {
    const accounts = [
      { status: 'ACTIVE', channel: 'EBAY', firstImportCompletedAt: new Date() },
      { status: 'ACTIVE', channel: 'POSHMARK', firstImportCompletedAt: null },
      { status: 'REVOKED', channel: 'MERCARI', firstImportCompletedAt: null },
    ];
    setupMocks(accounts, [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-7');

    // Only ACTIVE accounts contribute to connectedChannels
    expect(result.connectedChannels).toHaveLength(2);
    expect(result.connectedChannels).toContain('eBay');
    expect(result.connectedChannels).toContain('Poshmark');
    expect(result.connectedChannels).not.toContain('Mercari');
  });

  // Test 8
  it('returns correct availableImportChannels (ACTIVE accounts where firstImportCompletedAt is null)', async () => {
    const accounts = [
      { status: 'ACTIVE', channel: 'EBAY', firstImportCompletedAt: new Date('2026-01-01') },
      { status: 'ACTIVE', channel: 'POSHMARK', firstImportCompletedAt: null },
      { status: 'ACTIVE', channel: 'MERCARI', firstImportCompletedAt: null },
    ];
    setupMocks(accounts, [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-8');

    // eBay already completed its first import — excluded from available
    expect(result.availableImportChannels).toHaveLength(2);
    expect(result.availableImportChannels).toContain('Poshmark');
    expect(result.availableImportChannels).toContain('Mercari');
    expect(result.availableImportChannels).not.toContain('eBay');
  });

  // Test 9
  it('returns correct listerTier from sellerProfile', async () => {
    setupMocks([], [], [{ listerTier: 'PRO' }]);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-9');

    expect(result.listerTier).toBe('PRO');
  });

  // Test 10
  it('returns listerTier NONE when seller has no sellerProfile row', async () => {
    setupMocks([], [], []);

    const { getImportOnboardingState } = await import('../import-onboarding');
    const result = await getImportOnboardingState('user-test-10');

    expect(result.listerTier).toBe('NONE');
  });
});
