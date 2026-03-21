/**
 * Admin Shipping Queries (I14)
 * Reads shipping-related platform settings for the Shipping Admin page.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { like } from 'drizzle-orm';

export type ShippingSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
};

/**
 * Returns all platform_settings with key matching 'shipping.%'.
 */
export async function getShippingAdminSettings(): Promise<ShippingSettingRow[]> {
  const rows = await db
    .select({
      key: platformSetting.key,
      value: platformSetting.value,
      description: platformSetting.description,
    })
    .from(platformSetting)
    .where(like(platformSetting.key, 'shipping.%'));

  return rows;
}
