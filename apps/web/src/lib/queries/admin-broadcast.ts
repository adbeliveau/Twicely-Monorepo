/**
 * Admin Broadcast Settings Query (I11)
 * Fetches platform settings with key prefix 'broadcast.'
 * for the Admin Broadcast Messages page.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { asc } from 'drizzle-orm';

export interface BroadcastSettingRow {
  key: string;
  value: string;
  label: string | null;
}

/**
 * Return all platform settings whose key starts with 'broadcast.'.
 * Values are cast to string (broadcast settings are simple string/boolean jsonb).
 */
export async function getBroadcastSettings(): Promise<BroadcastSettingRow[]> {
  const rows = await db
    .select({
      key: platformSetting.key,
      value: platformSetting.value,
      label: platformSetting.description,
    })
    .from(platformSetting)
    .orderBy(asc(platformSetting.key));

  return rows
    .filter((r) => r.key.startsWith('broadcast.'))
    .map((r) => ({
      key: r.key,
      value: typeof r.value === 'string' ? r.value : JSON.stringify(r.value),
      label: r.label ?? null,
    }));
}
