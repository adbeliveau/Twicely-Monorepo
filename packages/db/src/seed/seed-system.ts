import { hash } from 'bcryptjs';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { feeSchedule, sequenceCounter, staffUser, staffUserRole } from '../schema';
import { CATEGORY_IDS } from './seed-categories';

// Hardcoded IDs for idempotency
const STAFF_ADMIN_ID = 'seed-staff-admin-001';

const FEE_SCHEDULE_IDS = {
  electronics: 'seed-fee-electronics',
  apparel: 'seed-fee-apparel',
  home: 'seed-fee-home',
  collectibles: 'seed-fee-collectibles',
};

const SEQUENCE_IDS = {
  orderNumber: 'seed-seq-order-number',
  caseNumber: 'seed-seq-case-number',
};

const STAFF_ROLE_ID = 'seed-staff-role-admin';

/**
 * Seed system data: staff user, fee schedules, sequence counters.
 * Must run BEFORE seedCategories (categories need fee schedules reference).
 */
export async function seedSystem(db: PostgresJsDatabase): Promise<void> {
  // 1. Staff user (need ID for fee schedules createdByStaffId)
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword) {
    throw new Error('SEED_ADMIN_PASSWORD env var is required — set it before running seed');
  }
  const staffPasswordHash = await hash(seedPassword, 12);

  await db.insert(staffUser).values({
    id: STAFF_ADMIN_ID,
    email: 'admin@hub.twicely.co',
    displayName: 'Platform Admin',
    passwordHash: staffPasswordHash,
    mfaEnabled: false,
    mfaRequired: true,
    isActive: true,
  }).onConflictDoNothing();

  await db.insert(staffUserRole).values({
    id: STAFF_ROLE_ID,
    staffUserId: STAFF_ADMIN_ID,
    role: 'SUPER_ADMIN',
    grantedByStaffId: STAFF_ADMIN_ID,
  }).onConflictDoNothing();

  // 2. Fee schedules (4)
  // v3.2: Progressive TF brackets replace old category-based fees. See pricing canonical §2.
  // These fee schedules are LEGACY - kept for backwards compatibility with existing orders.
  // New orders use TF brackets from platform_settings (commerce.tf.bracket*).
  const effectiveAt = new Date('2026-01-01T00:00:00Z');

  await db.insert(feeSchedule).values([
    {
      id: FEE_SCHEDULE_IDS.electronics,
      feeBucket: 'ELECTRONICS',
      tfRateBps: 900, // Legacy base rate in basis points - not used for new orders
      insertionFeeCents: 25,
      effectiveAt,
      createdByStaffId: STAFF_ADMIN_ID,
    },
    {
      id: FEE_SCHEDULE_IDS.apparel,
      feeBucket: 'APPAREL_ACCESSORIES',
      tfRateBps: 1000,
      insertionFeeCents: 25,
      effectiveAt,
      createdByStaffId: STAFF_ADMIN_ID,
    },
    {
      id: FEE_SCHEDULE_IDS.home,
      feeBucket: 'HOME_GENERAL',
      tfRateBps: 1000,
      insertionFeeCents: 25,
      effectiveAt,
      createdByStaffId: STAFF_ADMIN_ID,
    },
    {
      id: FEE_SCHEDULE_IDS.collectibles,
      feeBucket: 'COLLECTIBLES_LUXURY',
      tfRateBps: 1150,
      insertionFeeCents: 25,
      effectiveAt,
      createdByStaffId: STAFF_ADMIN_ID,
    },
  ]).onConflictDoNothing();

  // 3. Sequence counters (2)
  await db.insert(sequenceCounter).values([
    {
      id: SEQUENCE_IDS.orderNumber,
      name: 'order_number',
      prefix: 'TWC-',
      currentValue: 0,
      paddedWidth: 6,
    },
    {
      id: SEQUENCE_IDS.caseNumber,
      name: 'case_number',
      prefix: 'HD-',
      currentValue: 0,
      paddedWidth: 6,
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const SEED_IDS = {
  staffAdminId: STAFF_ADMIN_ID,
  categories: CATEGORY_IDS,
  feeSchedules: FEE_SCHEDULE_IDS,
  sequences: SEQUENCE_IDS,
};
