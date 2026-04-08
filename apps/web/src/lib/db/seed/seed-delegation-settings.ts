import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting } from '@twicely/db/schema';

/**
 * Seed delegation platform settings.
 * Three settings controlling staff invitation limits and security requirements.
 * Source: Feature Lock-in section 26.
 */
export async function seedDelegationSettings(db: PostgresJsDatabase): Promise<void> {
  await db.insert(platformSetting).values([
    {
      id: 'seed-delegation-001',
      key: 'delegation.maxStaffPerSeller',
      value: 10,
      type: 'number',
      category: 'delegation',
      description: 'Platform-wide maximum staff members per seller (capped by tier limit)',
    },
    {
      id: 'seed-delegation-002',
      key: 'delegation.require2faForHighRisk',
      value: true,
      type: 'boolean',
      category: 'delegation',
      description: 'Owner must have 2FA enabled to grant high-risk scopes',
    },
    {
      id: 'seed-delegation-003',
      key: 'delegation.payoutChangeHoldHours',
      value: 72,
      type: 'number',
      category: 'delegation',
      description: 'Hold period after a delegated staff member changes payout destination',
    },
  ]).onConflictDoNothing();
}
