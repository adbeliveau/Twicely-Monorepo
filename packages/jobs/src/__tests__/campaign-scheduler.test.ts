import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ------------------------------------------------------------------

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
const mockSelectResult: unknown[] = [];

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockSelectResult),
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  scheduledPromoTask: {
    id: 'id', campaignId: 'campaign_id', taskType: 'task_type',
    scheduledFor: 'scheduled_for', status: 'status',
    executedAt: 'executed_at', errorMessage: 'error_message',
  },
  promotionCampaign: { id: 'id', status: 'status' },
  campaignPromotion: { campaignId: 'campaign_id', promotionId: 'promotion_id' },
  promotion: { id: 'id', isActive: 'is_active' },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, def: unknown) => Promise.resolve(def)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  lte: vi.fn((...args: unknown[]) => ({ op: 'lte', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

// Mock the dynamic import of commerce
vi.mock('@twicely/commerce/campaign-lifecycle', () => ({
  updateCampaignStatus: vi.fn().mockResolvedValue({ success: true }),
}));

// --- Tests ------------------------------------------------------------------

describe('V4-06: Campaign Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult.length = 0;
  });

  describe('registerCampaignSchedulerJob', () => {
    it('registers repeatable job with default pattern', async () => {
      const { registerCampaignSchedulerJob } = await import('../campaign-scheduler');
      await registerCampaignSchedulerJob();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'tick',
        expect.objectContaining({ triggeredAt: expect.any(String) }),
        expect.objectContaining({
          jobId: 'campaign-scheduler-tick',
          repeat: { pattern: '* * * * *', tz: 'UTC' },
        }),
      );
    });
  });

  describe('createCampaignSchedulerWorker', () => {
    it('is exported as a factory function', async () => {
      const { createCampaignSchedulerWorker } = await import('../campaign-scheduler');
      expect(typeof createCampaignSchedulerWorker).toBe('function');
    });
  });

  describe('campaignSchedulerQueue', () => {
    it('is exported', async () => {
      const { campaignSchedulerQueue } = await import('../campaign-scheduler');
      expect(campaignSchedulerQueue).toBeDefined();
      expect(typeof campaignSchedulerQueue.add).toBe('function');
    });
  });
});
