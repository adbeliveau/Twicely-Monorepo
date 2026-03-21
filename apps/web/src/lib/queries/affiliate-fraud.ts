/**
 * Affiliate Fraud Queries (G3.5)
 *
 * Queries for fraud signals, related accounts, and fraud summaries.
 * Powers the hub fraud panel at /usr/affiliates/[id].
 */

import { db } from '@twicely/db';
import { auditEvent, session, user, affiliate } from '@twicely/db/schema';
import { eq, and, ne, inArray, desc } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FraudSignalRow {
  id: string;
  action: string;
  severity: string;
  detailsJson: unknown;
  createdAt: Date;
}

export interface RelatedAccount {
  userId: string;
  username: string | null;
  emailMasked: string;
  sharedIps: string[];
  matchType: 'IP_OVERLAP';
}

export interface FraudSummary {
  totalSignals: number;
  warningsIssued: number;
  currentRiskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastScanDate: Date | null;
}

// ─── getAffiliateFraudSignals ─────────────────────────────────────────────────

/**
 * Returns audit events of type AFFILIATE_FRAUD_* for this affiliate,
 * ordered by createdAt DESC, limited to 100.
 */
export async function getAffiliateFraudSignals(
  affiliateId: string,
): Promise<FraudSignalRow[]> {
  const FRAUD_ACTIONS = [
    'AFFILIATE_FRAUD_WARNING',
    'AFFILIATE_FRAUD_SUSPENDED',
    'AFFILIATE_FRAUD_BANNED',
    'AFFILIATE_FRAUD_SIGNAL',
  ];

  const rows = await db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      severity: auditEvent.severity,
      detailsJson: auditEvent.detailsJson,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.subject, 'Affiliate'),
        eq(auditEvent.subjectId, affiliateId),
        inArray(auditEvent.action, FRAUD_ACTIONS),
      ),
    )
    .orderBy(desc(auditEvent.createdAt))
    .limit(100);

  return rows;
}

// ─── getRelatedAccountsByIp ───────────────────────────────────────────────────

/**
 * Finds other user accounts that share session IPs with the given user.
 * Powers the "Related Accounts (Fraud Investigation)" section.
 * Does NOT return the queried user themselves.
 */
export async function getRelatedAccountsByIp(
  userId: string,
): Promise<RelatedAccount[]> {
  // Get all IPs from this user's sessions
  const userSessions = await db
    .select({ ipAddress: session.ipAddress })
    .from(session)
    .where(
      and(
        eq(session.userId, userId),
        ne(session.ipAddress, ''),
      ),
    );

  const userIps = [
    ...new Set(
      userSessions
        .map((s) => s.ipAddress)
        .filter((ip): ip is string => ip !== null && ip !== ''),
    ),
  ];

  if (userIps.length === 0) {
    return [];
  }

  // Find other users who have sessions from these same IPs
  const otherSessions = await db
    .select({
      userId: session.userId,
      ipAddress: session.ipAddress,
    })
    .from(session)
    .where(
      and(
        ne(session.userId, userId),
        inArray(session.ipAddress, userIps),
      ),
    );

  if (otherSessions.length === 0) {
    return [];
  }

  // Group by userId → collect shared IPs
  const overlap = new Map<string, Set<string>>();
  for (const row of otherSessions) {
    if (!row.ipAddress) continue;
    if (!overlap.has(row.userId)) {
      overlap.set(row.userId, new Set());
    }
    overlap.get(row.userId)!.add(row.ipAddress);
  }

  const relatedUserIds = [...overlap.keys()];

  const users = await db
    .select({ id: user.id, username: user.username, email: user.email })
    .from(user)
    .where(inArray(user.id, relatedUserIds));

  const results: RelatedAccount[] = [];
  for (const u of users) {
    const sharedIps = [...(overlap.get(u.id) ?? new Set<string>())];
    const [localPart = '', domain = ''] = u.email.split('@');
    const maskedLocal = localPart.length <= 2
      ? '*'.repeat(localPart.length)
      : `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`;
    results.push({
      userId: u.id,
      username: u.username ?? null,
      emailMasked: `${maskedLocal}@${domain}`,
      sharedIps,
      matchType: 'IP_OVERLAP',
    });
  }

  return results;
}

// ─── getAffiliateFraudSummary ─────────────────────────────────────────────────

/**
 * Returns aggregate fraud stats for the affiliate.
 */
export async function getAffiliateFraudSummary(
  affiliateId: string,
): Promise<FraudSummary> {
  const FRAUD_ACTIONS = [
    'AFFILIATE_FRAUD_WARNING',
    'AFFILIATE_FRAUD_SUSPENDED',
    'AFFILIATE_FRAUD_BANNED',
    'AFFILIATE_FRAUD_SIGNAL',
  ];

  const signals = await db
    .select({
      action: auditEvent.action,
      severity: auditEvent.severity,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.subject, 'Affiliate'),
        eq(auditEvent.subjectId, affiliateId),
        inArray(auditEvent.action, FRAUD_ACTIONS),
      ),
    )
    .orderBy(desc(auditEvent.createdAt));

  const totalSignals = signals.length;
  const warningsIssued = signals.filter(
    (s) => s.action === 'AFFILIATE_FRAUD_WARNING',
  ).length;
  const lastScanDate = signals[0]?.createdAt ?? null;

  const [affRecord] = await db
    .select({ warningCount: affiliate.warningCount, status: affiliate.status })
    .from(affiliate)
    .where(eq(affiliate.id, affiliateId))
    .limit(1);

  let currentRiskLevel: FraudSummary['currentRiskLevel'] = 'NONE';
  if (affRecord) {
    if (affRecord.status === 'BANNED') {
      currentRiskLevel = 'CRITICAL';
    } else if (affRecord.status === 'SUSPENDED') {
      currentRiskLevel = 'HIGH';
    } else if (affRecord.warningCount >= 2) {
      currentRiskLevel = 'HIGH';
    } else if (affRecord.warningCount === 1) {
      currentRiskLevel = 'MEDIUM';
    } else if (totalSignals > 0) {
      currentRiskLevel = 'LOW';
    }
  }

  return { totalSignals, warningsIssued, currentRiskLevel, lastScanDate };
}
