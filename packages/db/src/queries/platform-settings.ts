/**
 * Platform Settings Query Utility
 *
 * Reads configuration values from the platform_setting table.
 * All fee rates, limits, and configurable business rules
 * must be read from this table — never hardcoded.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq, like } from 'drizzle-orm';

/**
 * Get a single platform setting value by key.
 * Returns the parsed JSON value, or the fallback if not found.
 */
export async function getPlatformSetting<T>(
  key: string,
  fallback: T
): Promise<T> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);

  if (!row) return fallback;
  return row.value as T;
}

/**
 * Get multiple platform settings by key prefix.
 * Returns a map of key → parsed value.
 *
 * NOTE: prefix is always a hardcoded domain namespace (e.g. "commerce."),
 * never user-controlled input — SQL LIKE wildcard escaping is not required.
 */
export async function getPlatformSettingsByPrefix(
  prefix: string
): Promise<Map<string, unknown>> {
  if (!prefix) return new Map();
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(like(platformSetting.key, `${prefix}%`));

  const result = new Map<string, unknown>();
  for (const row of rows) {
    result.set(row.key, row.value);
  }
  return result;
}
