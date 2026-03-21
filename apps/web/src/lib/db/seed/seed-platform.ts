import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting } from '../schema';
import { V32_ALL_SETTINGS } from './v32-platform-settings';
import { SEED_IDS } from './seed-system';
import { SEED_I14_SETTINGS } from './seed-i14-settings';

/**
 * Seed platform settings from v3.2 canonical pricing document.
 * Total: 104 settings covering TF brackets, escrow, payout, subscriptions, etc.
 */
export async function seedPlatform(db: PostgresJsDatabase): Promise<void> {
  // Platform settings - v3.2 canonical values
  // Every configurable value from TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
  for (const setting of V32_ALL_SETTINGS) {
    await db.insert(platformSetting).values({
      key: setting.key,
      value: setting.value,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      updatedByStaffId: SEED_IDS.staffAdminId,
    }).onConflictDoUpdate({
      target: platformSetting.key,
      set: {
        value: setting.value,
        type: setting.type,
        category: setting.category,
        description: setting.description,
        updatedAt: new Date(),
      },
    });
  }

  // I14 settings: i18n, policy versioning, currency, shipping threshold, tax rules
  for (const setting of SEED_I14_SETTINGS) {
    await db.insert(platformSetting).values({
      key: setting.key,
      value: setting.value,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      updatedByStaffId: SEED_IDS.staffAdminId,
    }).onConflictDoUpdate({
      target: platformSetting.key,
      set: {
        value: setting.value,
        type: setting.type,
        category: setting.category,
        description: setting.description,
        updatedAt: new Date(),
      },
    });
  }
}
