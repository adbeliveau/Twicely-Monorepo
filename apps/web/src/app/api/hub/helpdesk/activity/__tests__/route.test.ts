import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockGetHelpdeskRecentActivity = vi.fn();
vi.mock('@/lib/queries/helpdesk-activity', () => ({
  getHelpdeskRecentActivity: (...args: unknown[]) => mockGetHelpdeskRecentActivity(...args),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeAllowed() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'staff-001',
    email: 'agent@hub.twicely.co',
    displayName: 'Agent',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function makeForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-002',
    email: 'limited@hub.twicely.co',
    displayName: 'Limited',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function makeUnauthorized() {
  mockStaffAuthorize.mockRejectedValue(new Error('Not authenticated'));
}

const SAMPLE_ACTIVITY = [
  { eventType: 'status_changed', agent: 'Alice', caseNumber: 'HD-000101', createdAt: new Date() },
  { eventType: 'created',         agent: 'System',  caseNumber: 'HD-000102', createdAt: new Date() },
];

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/hub/helpdesk/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 200 with activity array for authenticated staff', async () => {
    makeAllowed();
    mockGetHelpdeskRecentActivity.mockResolvedValue(SAMPLE_ACTIVITY);

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.activity)).toBe(true);
    expect((body.activity as unknown[]).length).toBe(2);
  });

  it('returns 401 for unauthenticated requests', async () => {
    makeUnauthorized();

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when CASL denies read on HelpdeskCase', async () => {
    makeForbidden();

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Forbidden');
  });

  it('returns at most 10 items (getHelpdeskRecentActivity limits to 10)', async () => {
    makeAllowed();
    // Simulate the query returning exactly 10 items
    const tenItems = Array.from({ length: 10 }, (_, i) => ({
      eventType: 'status_changed',
      agent: `Agent ${i}`,
      caseNumber: `HD-0001${String(i).padStart(2, '0')}`,
      createdAt: new Date(),
    }));
    mockGetHelpdeskRecentActivity.mockResolvedValue(tenItems);

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as Record<string, unknown>;
    expect((body.activity as unknown[]).length).toBeLessThanOrEqual(10);
  });

  it('returns empty array when there is no recent activity', async () => {
    makeAllowed();
    mockGetHelpdeskRecentActivity.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET();
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect((body.activity as unknown[]).length).toBe(0);
  });
});
