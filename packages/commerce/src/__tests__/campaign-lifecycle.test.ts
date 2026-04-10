import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn().mockResolvedValue([{ id: 'task-1' }]);

// makeSelectWhere returns a thenable that resolves to [] by default AND exposes .limit()
// This handles both:
//   await db.select().from().where()          (used in setLinkedPromotionState)
//   await db.select().from().where().limit()  (used in updateCampaignStatus / scheduleCampaignTasks)
function makeSelectWhere(...args: unknown[]) {
  mockSelectWhere(...args);
  // Return a thenable that resolves to [] when awaited directly (no .limit()),
  // but also exposes .limit() for chains that call it.
  return {
    limit: (...c: unknown[]) => mockLimit(...c),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve([]).catch(reject),
  };
}

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: (...a: unknown[]) => { mockFrom(...a); return { where: (...b: unknown[]) => makeSelectWhere(...b) }; } };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return { set: (...a: unknown[]) => { mockSet(...a); return { where: (...b: unknown[]) => mockUpdateWhere(...b) }; } };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: (...a: unknown[]) => { mockValues(...a); return { returning: (...b: unknown[]) => mockReturning(...b) }; } };
    },
  },
}));

vi.mock('@twicely/db/schema', () => ({
  promotionCampaign: { id: 'id', status: 'status', startsAt: 'starts_at', endsAt: 'ends_at', updatedAt: 'updated_at' },
  campaignPromotion: { campaignId: 'campaign_id', promotionId: 'promotion_id' },
  scheduledPromoTask: { id: 'id', campaignId: 'campaign_id', status: 'status', executedAt: 'executed_at', scheduledFor: 'scheduled_for', taskType: 'task_type' },
  promotion: { id: 'id', isActive: 'is_active', updatedAt: 'updated_at' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

import { VALID_TRANSITIONS, type CampaignStatus } from '../campaign-lifecycle';

// --- Tests ------------------------------------------------------------------

describe('V4-06: Campaign Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VALID_TRANSITIONS', () => {
    it('DRAFT can transition to SCHEDULED or CANCELED', () => {
      expect(VALID_TRANSITIONS.DRAFT).toEqual(['SCHEDULED', 'CANCELED']);
    });

    it('SCHEDULED can transition to ACTIVE, PAUSED, or CANCELED', () => {
      expect(VALID_TRANSITIONS.SCHEDULED).toEqual(['ACTIVE', 'PAUSED', 'CANCELED']);
    });

    it('ACTIVE can transition to PAUSED, COMPLETED, or CANCELED', () => {
      expect(VALID_TRANSITIONS.ACTIVE).toEqual(['PAUSED', 'COMPLETED', 'CANCELED']);
    });

    it('PAUSED can transition to ACTIVE, CANCELED, or COMPLETED', () => {
      expect(VALID_TRANSITIONS.PAUSED).toEqual(['ACTIVE', 'CANCELED', 'COMPLETED']);
    });

    it('COMPLETED is a terminal state', () => {
      expect(VALID_TRANSITIONS.COMPLETED).toEqual([]);
    });

    it('CANCELED is a terminal state', () => {
      expect(VALID_TRANSITIONS.CANCELED).toEqual([]);
    });

    it('all statuses have a transitions entry', () => {
      const statuses: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED'];
      for (const status of statuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });
  });

  describe('updateCampaignStatus', () => {
    it('returns error when campaign is not found', async () => {
      // mockLimit already returns [] by default
      const { updateCampaignStatus } = await import('../campaign-lifecycle');
      const result = await updateCampaignStatus('nonexistent', 'ACTIVE');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('returns error for invalid transition', async () => {
      // Return a campaign in COMPLETED state
      mockLimit.mockResolvedValueOnce([{ id: 'c1', status: 'COMPLETED' }]);

      const { updateCampaignStatus } = await import('../campaign-lifecycle');
      const result = await updateCampaignStatus('c1', 'ACTIVE');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('succeeds for valid DRAFT -> SCHEDULED transition', async () => {
      // First call: select campaign (returns DRAFT)
      mockLimit.mockResolvedValueOnce([{ id: 'c1', status: 'DRAFT' }]);
      // Second call: select linked promotions (none)
      // The mock chain returns [] by default

      const { updateCampaignStatus } = await import('../campaign-lifecycle');
      const result = await updateCampaignStatus('c1', 'SCHEDULED', 'staff-1', 'Test');
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('succeeds for valid DRAFT -> CANCELED transition', async () => {
      mockLimit.mockResolvedValueOnce([{ id: 'c1', status: 'DRAFT' }]);

      const { updateCampaignStatus } = await import('../campaign-lifecycle');
      const result = await updateCampaignStatus('c1', 'CANCELED');
      expect(result.success).toBe(true);
    });
  });

  describe('scheduleCampaignTasks', () => {
    it('throws when campaign not found', async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { scheduleCampaignTasks } = await import('../campaign-lifecycle');
      await expect(scheduleCampaignTasks('nonexistent')).rejects.toThrow('Campaign nonexistent not found');
    });

    it('creates activate and deactivate tasks', async () => {
      const startsAt = new Date('2026-06-01T00:00:00Z');
      const endsAt = new Date('2026-06-30T23:59:59Z');

      mockLimit.mockResolvedValueOnce([{ id: 'c1', startsAt, endsAt }]);
      mockReturning
        .mockResolvedValueOnce([{ id: 'activate-task-1' }])
        .mockResolvedValueOnce([{ id: 'deactivate-task-1' }]);

      const { scheduleCampaignTasks } = await import('../campaign-lifecycle');
      const result = await scheduleCampaignTasks('c1');

      expect(result.activateTaskId).toBe('activate-task-1');
      expect(result.deactivateTaskId).toBe('deactivate-task-1');
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });
});
