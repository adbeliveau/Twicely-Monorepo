/**
 * Seed crosslister platform settings, channel category mappings, and policy rules.
 * Source: Lister Canonical Sections 7.3, 8.3, 27.1, 27.2; Feature Lock-in Section 46
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting, channelCategoryMapping, channelPolicyRule } from '@twicely/db/schema';
import { CROSSLISTER_SETTINGS } from './seed-crosslister-settings';
import { CHANNEL_CATEGORY_MAPPINGS, CHANNEL_POLICY_RULES } from './seed-crosslister-mappings';

/**
 * Seed crosslister platform settings, channel category mappings, and policy rules.
 */
export async function seedCrosslister(db: PostgresJsDatabase): Promise<void> {
  // 1. Platform settings
  for (const setting of CROSSLISTER_SETTINGS) {
    await db
      .insert(platformSetting)
      .values({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: 'crosslister',
        description: setting.description,
      })
      .onConflictDoNothing();
  }

  // 2. Channel category mappings — 3 platforms, top-level Twicely categories
  // Demonstrates the mapping pattern; production mappings are a data migration.
  await db
    .insert(channelCategoryMapping)
    .values([...CHANNEL_CATEGORY_MAPPINGS])
    .onConflictDoNothing();

  // 3. Channel policy rules — 5 rules demonstrating the pattern
  await db
    .insert(channelPolicyRule)
    .values([...CHANNEL_POLICY_RULES])
    .onConflictDoNothing();
}
