/**
 * Admin Search Index Rebuild Action Tests (I11)
 * Covers rebuildSearchIndexAction authorization, validation, and audit event.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { insert: (...args: unknown[]) => mockDbInsert(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: { id: 'id', action: 'action' },
}));

const mockGetInfraConfig = vi.fn();
vi.mock('@/lib/config/infra-config', () => ({
  getInfraConfig: (...args: unknown[]) => mockGetInfraConfig(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanManageSetting() {
  const ability = {
    can: vi.fn((action: string, subject: string) => action === 'manage' && subject === 'Setting'),
  };
  const session = {
    staffUserId: 'staff-admin-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function makeForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-dev-001',
    email: 'dev@twicely.co',
    displayName: 'Developer',
    isPlatformStaff: true as const,
    platformRoles: ['DEVELOPER'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockConfigured() {
  mockGetInfraConfig.mockReturnValue({
    typesenseUrl: 'http://localhost:8108',
    typesenseApiKey: 'test-key',
    valkeyHost: '127.0.0.1',
    valkeyPort: 6379,
    centrifugoApiUrl: '',
    centrifugoApiKey: '',
  });
}

function mockNotConfigured() {
  mockGetInfraConfig.mockReturnValue({
    typesenseUrl: '',
    typesenseApiKey: '',
    valkeyHost: '127.0.0.1',
    valkeyPort: 6379,
    centrifugoApiUrl: '',
    centrifugoApiKey: '',
  });
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// ─── rebuildSearchIndexAction ─────────────────────────────────────────────────

describe('rebuildSearchIndexAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when staff cannot manage Setting', async () => {
    makeForbidden();
    const { rebuildSearchIndexAction } = await import('../admin-search');

    const result = await rebuildSearchIndexAction('listings');

    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when Typesense is not configured', async () => {
    makeCanManageSetting();
    mockNotConfigured();
    const { rebuildSearchIndexAction } = await import('../admin-search');

    const result = await rebuildSearchIndexAction('listings');

    expect(result).toEqual({ error: 'Typesense not configured' });
  });

  it('writes audit event and returns success', async () => {
    makeCanManageSetting();
    mockConfigured();
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { rebuildSearchIndexAction } = await import('../admin-search');

    const result = await rebuildSearchIndexAction('listings');

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('returns error when collectionName is empty string', async () => {
    makeCanManageSetting();
    mockConfigured();
    const { rebuildSearchIndexAction } = await import('../admin-search');

    const result = await rebuildSearchIndexAction('');

    expect(result).toMatchObject({ error: expect.any(String) });
  });

  it('returns error on DB insert failure', async () => {
    makeCanManageSetting();
    mockConfigured();
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const { rebuildSearchIndexAction } = await import('../admin-search');

    const result = await rebuildSearchIndexAction('listings');

    expect(result).toMatchObject({ error: 'Search index rebuild failed' });
  });
});
