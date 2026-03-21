/**
 * Extension heartbeat status query.
 * Infers browser extension presence from recent SESSION-based crosslister accounts.
 * Source: H1.4 install prompt §2.4
 *
 * Strategy:
 * - Query crosslisterAccount WHERE sellerId matches AND authMethod = 'SESSION'
 * - hasExtension = true if ANY session account has lastAuthAt within 30 minutes
 * - sessionExpired = true if status is REAUTHENTICATION_REQUIRED, lastAuthAt is null,
 *   or lastAuthAt is older than 24 hours
 */

import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';

// 30-minute threshold for "extension recently active" heuristic
const EXTENSION_ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;

// 24-hour threshold for Tier C session staleness
const SESSION_EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface TierCAccountStatus {
  channel: string;
  status: string;
  lastAuthAt: Date | null;
  sessionExpired: boolean;
}

export interface ExtensionStatusData {
  hasExtension: boolean;
  lastHeartbeatAt: Date | null;
  tierCAccounts: TierCAccountStatus[];
}

/**
 * Get extension heartbeat status for a seller by inspecting SESSION-based accounts.
 * Only POSHMARK, THEREALREAL, and VESTIAIRE are Tier C SESSION channels.
 */
export async function getExtensionStatus(sellerId: string): Promise<ExtensionStatusData> {
  const rows = await db
    .select({
      channel: crosslisterAccount.channel,
      status: crosslisterAccount.status,
      lastAuthAt: crosslisterAccount.lastAuthAt,
    })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, sellerId),
        eq(crosslisterAccount.authMethod, 'SESSION'),
      ),
    );

  const now = Date.now();

  const tierCAccounts: TierCAccountStatus[] = rows.map((row) => {
    const lastAuthAt = row.lastAuthAt ?? null;

    const isReauthRequired = row.status === 'REAUTHENTICATION_REQUIRED';
    const isNullDate = lastAuthAt === null;
    const isStale =
      lastAuthAt !== null &&
      now - lastAuthAt.getTime() > SESSION_EXPIRY_THRESHOLD_MS;

    const sessionExpired = isReauthRequired || isNullDate || isStale;

    return {
      channel: row.channel,
      status: row.status,
      lastAuthAt,
      sessionExpired,
    };
  });

  // Most recent lastAuthAt across all SESSION accounts
  const recentDates = tierCAccounts
    .map((a) => a.lastAuthAt)
    .filter((d): d is Date => d !== null);

  const lastHeartbeatAt: Date | null =
    recentDates.length > 0
      ? recentDates.reduce((latest, d) => (d > latest ? d : latest))
      : null;

  // Extension is considered active if any SESSION account has lastAuthAt within threshold
  const hasExtension =
    lastHeartbeatAt !== null &&
    now - lastHeartbeatAt.getTime() <= EXTENSION_ACTIVE_THRESHOLD_MS;

  return {
    hasExtension,
    lastHeartbeatAt,
    tierCAccounts,
  };
}
