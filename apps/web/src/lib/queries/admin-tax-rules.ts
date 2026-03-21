/**
 * Admin Tax Rules Queries (I14)
 * Reads tax-related platform settings for the Tax Rules page.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { like } from 'drizzle-orm';

export type TaxSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
};

/**
 * Returns all platform_settings with key matching 'tax.%'.
 */
export async function getTaxRuleSettings(): Promise<TaxSettingRow[]> {
  const rows = await db
    .select({
      key: platformSetting.key,
      value: platformSetting.value,
      description: platformSetting.description,
    })
    .from(platformSetting)
    .where(like(platformSetting.key, 'tax.%'));

  return rows;
}
