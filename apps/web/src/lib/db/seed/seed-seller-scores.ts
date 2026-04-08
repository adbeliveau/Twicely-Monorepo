import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sellerScoreSnapshot } from '@twicely/db/schema';
import { SELLER_IDS } from './seed-users';

// Hardcoded IDs for idempotency
const SNAPSHOT_IDS = {
  seller1Month1: 'seed-sss-001',
  seller1Month2: 'seed-sss-002',
  seller2Month1: 'seed-sss-003',
  seller2Month2: 'seed-sss-004',
  seller3Month1: 'seed-sss-005',
  seller3Month2: 'seed-sss-006',
};

const COMPONENT_SCORES_ESTABLISHED = {
  shippingSpeed:  85,
  itemAccuracy:   88,
  communication:  80,
  defectRate:     90,
  cancelRate:     88,
};

const COMPONENT_SCORES_ESTABLISHED_LOWER = {
  shippingSpeed:  82,
  itemAccuracy:   85,
  communication:  78,
  defectRate:     88,
  cancelRate:     85,
};

const COMPONENT_SCORES_TOP_RATED = {
  shippingSpeed:  95,
  itemAccuracy:   96,
  communication:  92,
  defectRate:     98,
  cancelRate:     96,
};

const COMPONENT_SCORES_TOP_RATED_LOWER = {
  shippingSpeed:  93,
  itemAccuracy:   94,
  communication:  90,
  defectRate:     96,
  cancelRate:     94,
};

/**
 * Seed seller score snapshots (2 per seller, covering last 2 months).
 * Depends on seedUsers() running first (needs seller profile IDs).
 */
export async function seedSellerScores(db: PostgresJsDatabase): Promise<void> {
  // Month 1: Jan 2026
  const jan2026Start = new Date('2026-01-01T00:00:00Z');
  const jan2026End   = new Date('2026-01-31T23:59:59Z');

  // Month 2: Feb 2026
  const feb2026Start = new Date('2026-02-01T00:00:00Z');
  const feb2026End   = new Date('2026-02-28T23:59:59Z');

  await db.insert(sellerScoreSnapshot).values([
    // seller1 (Mike) — ESTABLISHED band
    {
      id:                  SNAPSHOT_IDS.seller1Month1,
      sellerProfileId:     SELLER_IDS.seller1,
      overallScore:        75,
      componentScoresJson: COMPONENT_SCORES_ESTABLISHED_LOWER,
      performanceBand:     'ESTABLISHED',
      periodStart:         jan2026Start,
      periodEnd:           jan2026End,
      orderCount:          18,
      defectCount:         1,
      createdAt:           new Date('2026-02-01T06:00:00Z'),
    },
    {
      id:                  SNAPSHOT_IDS.seller1Month2,
      sellerProfileId:     SELLER_IDS.seller1,
      overallScore:        80,
      componentScoresJson: COMPONENT_SCORES_ESTABLISHED,
      performanceBand:     'ESTABLISHED',
      periodStart:         feb2026Start,
      periodEnd:           feb2026End,
      orderCount:          22,
      defectCount:         0,
      createdAt:           new Date('2026-03-01T06:00:00Z'),
    },
    // seller2 (Sarah) — ESTABLISHED band
    {
      id:                  SNAPSHOT_IDS.seller2Month1,
      sellerProfileId:     SELLER_IDS.seller2,
      overallScore:        70,
      componentScoresJson: COMPONENT_SCORES_ESTABLISHED_LOWER,
      performanceBand:     'ESTABLISHED',
      periodStart:         jan2026Start,
      periodEnd:           jan2026End,
      orderCount:          12,
      defectCount:         1,
      createdAt:           new Date('2026-02-01T06:00:00Z'),
    },
    {
      id:                  SNAPSHOT_IDS.seller2Month2,
      sellerProfileId:     SELLER_IDS.seller2,
      overallScore:        75,
      componentScoresJson: COMPONENT_SCORES_ESTABLISHED,
      performanceBand:     'ESTABLISHED',
      periodStart:         feb2026Start,
      periodEnd:           feb2026End,
      orderCount:          14,
      defectCount:         0,
      createdAt:           new Date('2026-03-01T06:00:00Z'),
    },
    // seller3 (Vintage Vault) — TOP_RATED band
    {
      id:                  SNAPSHOT_IDS.seller3Month1,
      sellerProfileId:     SELLER_IDS.seller3,
      overallScore:        90,
      componentScoresJson: COMPONENT_SCORES_TOP_RATED_LOWER,
      performanceBand:     'TOP_RATED',
      periodStart:         jan2026Start,
      periodEnd:           jan2026End,
      orderCount:          31,
      defectCount:         0,
      createdAt:           new Date('2026-02-01T06:00:00Z'),
    },
    {
      id:                  SNAPSHOT_IDS.seller3Month2,
      sellerProfileId:     SELLER_IDS.seller3,
      overallScore:        95,
      componentScoresJson: COMPONENT_SCORES_TOP_RATED,
      performanceBand:     'TOP_RATED',
      periodStart:         feb2026Start,
      periodEnd:           feb2026End,
      orderCount:          28,
      defectCount:         0,
      createdAt:           new Date('2026-03-01T06:00:00Z'),
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const SELLER_SCORE_IDS = SNAPSHOT_IDS;
