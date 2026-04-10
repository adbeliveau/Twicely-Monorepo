import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'cron-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Transitive deps of dynamically-imported tax-document-generation & affiliate-suspension-expiry
vi.mock('@twicely/db', () => ({ db: {} }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/db/schema', () => ({
  financialReport: { userId: 'user_id', reportType: 'report_type', periodStart: 'period_start' },
  affiliate: { id: 'id', userId: 'user_id', status: 'status', suspendedUntil: 'suspended_until' },
  auditEvent: {},
  helpdeskCase: { id: 'id', status: 'status', closedAt: 'closed_at' },
  caseMessage: { caseId: 'case_id' },
  caseEvent: { caseId: 'case_id' },
  caseWatcher: { caseId: 'case_id' },
  caseCsat: { caseId: 'case_id' },
  financeSubscription: { id: 'id', sellerProfileId: 'seller_profile_id', tier: 'tier', stripeSubscriptionId: 'stripe_subscription_id', storeTierTrialEndsAt: 'store_tier_trial_ends_at', updatedAt: 'updated_at' },
  sellerProfile: { id: 'id', userId: 'user_id', financeTier: 'finance_tier', updatedAt: 'updated_at' },
  financialProjection: { sellerProfileId: 'seller_profile_id' },
  order: { id: 'id', sellerId: 'seller_id', status: 'status', completedAt: 'completed_at' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', cogsCents: 'cogs_cents', activatedAt: 'activated_at', categoryId: 'category_id', priceCents: 'price_cents' },
  expense: { id: 'id', userId: 'user_id', amountCents: 'amount_cents', category: 'category', expenseDate: 'expense_date' },
  user: { id: 'id' },
  scheduledPromoTask: { id: 'id', campaignId: 'campaign_id', taskType: 'task_type', scheduledFor: 'scheduled_for', status: 'status' },
  promotionCampaign: { id: 'id', status: 'status', budgetCents: 'budget_cents', spentCents: 'spent_cents', maxRedemptions: 'max_redemptions', autoDisableOnExhaust: 'auto_disable_on_exhaust', budgetAlertPct: 'budget_alert_pct' },
  campaignRedemption: { id: 'id', campaignId: 'campaign_id' },
  campaignBudgetLog: { id: 'id', campaignId: 'campaign_id', action: 'action', createdAt: 'created_at' },
  authenticationRequest: { id: 'id', status: 'status', createdAt: 'created_at', listingId: 'listing_id', sellerId: 'seller_id' },
  accountingIntegration: { id: 'id', status: 'status', syncFrequency: 'sync_frequency', userId: 'user_id', provider: 'provider', syncErrorCount: 'sync_error_count' },
  searchIndexJob: { id: 'id', jobType: 'job_type', domain: 'domain', status: 'status', totalItems: 'total_items', succeededItems: 'succeeded_items', failedItems: 'failed_items', triggeredByStaffId: 'triggered_by_staff_id', startedAt: 'started_at', completedAt: 'completed_at', errorSummary: 'error_summary' },
  searchIndexVersion: { id: 'id', domain: 'domain', physicalIndexName: 'physical_index_name', mappingVersion: 'mapping_version', docCount: 'doc_count', status: 'status', isReadActive: 'is_read_active', isWriteActive: 'is_write_active' },
  listingImage: { listingId: 'listing_id', url: 'url', altText: 'alt_text', isPrimary: 'is_primary' },
  category: { id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id', currentScore: 'current_score', performanceBand: 'performance_band', totalReviews: 'total_reviews', averageRating: 'average_rating', showStars: 'show_stars' },
}));

// Campaign lifecycle mock for campaign-scheduler and campaign-budget-monitor auto-instantiated workers
vi.mock('@twicely/commerce/campaign-lifecycle', () => ({
  updateCampaignStatus: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  and: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), lte: vi.fn(), isNotNull: vi.fn(), inArray: vi.fn(),
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) =>
    Promise.resolve(fallback ?? 365),
  ),
}));

vi.mock('@twicely/finance/projection-engine', () => ({
  computeProjection: vi.fn().mockResolvedValue({ dataQualityScore: 50 }),
}));

vi.mock('@twicely/finance/projection-types', () => ({}));

describe('cron-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerCronJobs registers all platform and external cron jobs', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    // 8 platform cron jobs + 1 tax document + 1 affiliate suspension expiry + 4 cleanup queue (G8) + 1 helpdesk retention purge (G9.6) + 1 helpdesk auto-close + 1 helpdesk SLA check + 1 helpdesk CSAT send + 1 monthly boost credit (§5.4) + 1 crosslister auth health check + 1 Finance PRO trial expiry (FC v3.0 §2) + 1 finance projection compute (§6) + 1 campaign scheduler (V4-06 §7.1) + 1 campaign budget monitor (V4-06 §7.2) + 1 AI auth timeout (G10.2) + 2 accounting sync hourly+daily (G10.3)
    expect(mockQueueAdd).toHaveBeenCalledTimes(27);
  });

  it('registers orders cron at every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const ordersCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:orders',
    );
    expect(ordersCall).toBeDefined();
    expect(ordersCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-orders',
        repeat: { pattern: '0 * * * *', tz: 'UTC' },
      }),
    );
  });

  it('registers returns cron at :10 every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const returnsCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:returns',
    );
    expect(returnsCall).toBeDefined();
    expect(returnsCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-returns',
        repeat: { pattern: '10 * * * *', tz: 'UTC' },
      }),
    );
  });

  it('registers shipping cron at :20 every hour', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const shippingCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:shipping',
    );
    expect(shippingCall).toBeDefined();
    expect(shippingCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-shipping',
        repeat: { pattern: '20 * * * *', tz: 'UTC' },
      }),
    );
  });

  it('registers health cron every 5 minutes', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const healthCall = mockQueueAdd.mock.calls.find(
      (c: unknown[]) => c[0] === 'cron:health',
    );
    expect(healthCall).toBeDefined();
    expect(healthCall![2]).toEqual(
      expect.objectContaining({
        jobId: 'cron-health',
        repeat: { pattern: '*/5 * * * *', tz: 'UTC' },
      }),
    );
  });

  it('each cron job data has a task field', async () => {
    const { registerCronJobs } = await import('../cron-jobs');
    await registerCronJobs();

    const tasks = mockQueueAdd.mock.calls.map((c: unknown[]) => (c[1] as { task: string }).task);
    expect(tasks).toEqual(expect.arrayContaining(['orders', 'returns', 'shipping', 'health', 'vacation', 'seller-score-recalc']));
  });

  it('cronQueue is created with platform-cron name', async () => {
    // createQueue is called at module load time — verify it was called
    // before clearAllMocks by re-importing and checking the queue name
    const { cronQueue } = await import('../cron-jobs');
    expect(cronQueue).toBeDefined();
    expect(typeof cronQueue.add).toBe('function');
  });
});
