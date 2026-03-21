/**
 * Admin Connector Settings Queries (G10.13)
 * Reads crosslister platform_settings + connected account stats per connector.
 */

import { db } from '@twicely/db';
import { platformSetting, crosslisterAccount } from '@twicely/db/schema';
import { eq, and, count, like } from 'drizzle-orm';
import type { ExternalChannel } from '@twicely/crosslister/types';

export interface ConnectorSetting {
  id: string;
  key: string;
  value: unknown;
  type: string;
  description: string | null;
}

export interface ConnectorStats {
  connectedAccounts: number;
  activeAccounts: number;
}

/**
 * Fetch all platform_settings for a given connector prefix.
 * E.g., prefix="ebay" fetches all keys matching "crosslister.ebay.%"
 */
export async function getConnectorSettings(
  connectorPrefix: string
): Promise<ConnectorSetting[]> {
  return db
    .select({
      id: platformSetting.id,
      key: platformSetting.key,
      value: platformSetting.value,
      type: platformSetting.type,
      description: platformSetting.description,
    })
    .from(platformSetting)
    .where(like(platformSetting.key, `crosslister.${connectorPrefix}.%`));
}

/**
 * Get connected account stats for a channel.
 */
export async function getConnectorStats(
  channel: ExternalChannel
): Promise<ConnectorStats> {
  const [total, active] = await Promise.all([
    db
      .select({ c: count() })
      .from(crosslisterAccount)
      .where(eq(crosslisterAccount.channel, channel)),
    db
      .select({ c: count() })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.channel, channel),
          eq(crosslisterAccount.status, 'ACTIVE')
        )
      ),
  ]);

  return {
    connectedAccounts: total[0]?.c ?? 0,
    activeAccounts: active[0]?.c ?? 0,
  };
}
