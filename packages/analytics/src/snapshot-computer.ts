/**
 * @twicely/analytics -- Snapshot Computer
 *
 * Canonical 15 Section 8: Compute and persist pre-computed metric snapshots.
 * Daily: 12 metrics (GMV, orders, AOV, users, sellers, listings, fees, take rate, searches, refund rate, dispute rate).
 * Hourly: 3 metrics (GMV, orders, searches).
 * All money values in integer cents. Upsert via ON CONFLICT DO UPDATE for safe re-runs.
 */

import { db } from '@twicely/db';
import {
  order, user, listing, ledgerEntry,
  analyticsEvent, metricSnapshot, dispute,
} from '@twicely/db/schema';
import { sql, gte, lt, and, eq, count, desc } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { SnapshotComputeInput } from './types';

/** Platform fee types used for net revenue calculation. */
const PLATFORM_FEE_TYPES = [
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'INSERTION_FEE',
  'SUBSCRIPTION_CHARGE',
  'LOCAL_TRANSACTION_FEE',
  'CROSSLISTER_PLATFORM_FEE',
] as const;