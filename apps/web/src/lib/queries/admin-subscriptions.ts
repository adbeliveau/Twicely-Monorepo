/**
 * Admin Subscriptions Queries (I3)
 * Aggregates across all 5 subscription tables:
 * storeSubscription, listerSubscription, automationSubscription,
 * financeSubscription, bundleSubscription
 */

import { db } from '@twicely/db';
import {
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
  sellerProfile,
  user,
} from '@twicely/db/schema';
import { count, desc, eq, inArray } from 'drizzle-orm';

const ACTIVE_STATUS = 'ACTIVE';

export async function getSubscriptionStats() {
  const [storeCounts, listerCounts, automationCount, financeCounts, bundleCounts] =
    await Promise.all([
      db
        .select({ tier: storeSubscription.tier, total: count() })
        .from(storeSubscription)
        .where(eq(storeSubscription.status, ACTIVE_STATUS))
        .groupBy(storeSubscription.tier),
      db
        .select({ tier: listerSubscription.tier, total: count() })
        .from(listerSubscription)
        .where(eq(listerSubscription.status, ACTIVE_STATUS))
        .groupBy(listerSubscription.tier),
      db
        .select({ total: count() })
        .from(automationSubscription)
        .where(eq(automationSubscription.status, ACTIVE_STATUS)),
      db
        .select({ tier: financeSubscription.tier, total: count() })
        .from(financeSubscription)
        .where(eq(financeSubscription.status, ACTIVE_STATUS))
        .groupBy(financeSubscription.tier),
      db
        .select({ tier: bundleSubscription.tier, total: count() })
        .from(bundleSubscription)
        .where(eq(bundleSubscription.status, ACTIVE_STATUS))
        .groupBy(bundleSubscription.tier),
    ]);

  const storeMap = Object.fromEntries(storeCounts.map((r) => [r.tier, r.total]));
  const listerMap = Object.fromEntries(listerCounts.map((r) => [r.tier, r.total]));
  const financeMap = Object.fromEntries(financeCounts.map((r) => [r.tier, r.total]));
  const bundleMap = Object.fromEntries(bundleCounts.map((r) => [r.tier, r.total]));

  const storeActiveCount =
    (storeMap['STARTER'] ?? 0) +
    (storeMap['PRO'] ?? 0) +
    (storeMap['POWER'] ?? 0) +
    (storeMap['ENTERPRISE'] ?? 0);
  const listerActiveCount =
    (listerMap['FREE'] ?? 0) + (listerMap['LITE'] ?? 0) + (listerMap['PRO'] ?? 0);
  const automationActiveCount = automationCount[0]?.total ?? 0;
  const financeActiveCount = financeMap['PRO'] ?? 0;
  const bundleActiveCount =
    (bundleMap['STARTER'] ?? 0) + (bundleMap['PRO'] ?? 0) + (bundleMap['POWER'] ?? 0);

  const totalActiveSubscriptions =
    storeActiveCount +
    listerActiveCount +
    automationActiveCount +
    financeActiveCount +
    bundleActiveCount;

  return {
    totalActiveSubscriptions,
    store: { NONE: storeMap['NONE'] ?? 0, STARTER: storeMap['STARTER'] ?? 0, PRO: storeMap['PRO'] ?? 0, POWER: storeMap['POWER'] ?? 0, ENTERPRISE: storeMap['ENTERPRISE'] ?? 0 },
    lister: { NONE: listerMap['NONE'] ?? 0, FREE: listerMap['FREE'] ?? 0, LITE: listerMap['LITE'] ?? 0, PRO: listerMap['PRO'] ?? 0 },
    automation: { active: automationActiveCount },
    finance: { FREE: financeMap['FREE'] ?? 0, PRO: financeMap['PRO'] ?? 0 },
    bundle: { NONE: bundleMap['NONE'] ?? 0, STARTER: bundleMap['STARTER'] ?? 0, PRO: bundleMap['PRO'] ?? 0, POWER: bundleMap['POWER'] ?? 0 },
  };
}

interface RecentChange {
  sellerProfileId: string;
  userId: string | null;
  userName: string | null;
  axis: 'Store' | 'Lister' | 'Finance' | 'Automation' | 'Bundle';
  tier: string;
  status: string;
  updatedAt: Date;
}

export async function getRecentSubscriptionChanges(limit: number = 50): Promise<RecentChange[]> {
  const [storeRows, listerRows, automationRows, financeRows, bundleRows] = await Promise.all([
    db
      .select({ sellerProfileId: storeSubscription.sellerProfileId, tier: storeSubscription.tier, status: storeSubscription.status, updatedAt: storeSubscription.updatedAt })
      .from(storeSubscription)
      .orderBy(desc(storeSubscription.updatedAt))
      .limit(limit),
    db
      .select({ sellerProfileId: listerSubscription.sellerProfileId, tier: listerSubscription.tier, status: listerSubscription.status, updatedAt: listerSubscription.updatedAt })
      .from(listerSubscription)
      .orderBy(desc(listerSubscription.updatedAt))
      .limit(limit),
    db
      .select({ sellerProfileId: automationSubscription.sellerProfileId, status: automationSubscription.status, updatedAt: automationSubscription.updatedAt })
      .from(automationSubscription)
      .orderBy(desc(automationSubscription.updatedAt))
      .limit(limit),
    db
      .select({ sellerProfileId: financeSubscription.sellerProfileId, tier: financeSubscription.tier, status: financeSubscription.status, updatedAt: financeSubscription.updatedAt })
      .from(financeSubscription)
      .orderBy(desc(financeSubscription.updatedAt))
      .limit(limit),
    db
      .select({ sellerProfileId: bundleSubscription.sellerProfileId, tier: bundleSubscription.tier, status: bundleSubscription.status, updatedAt: bundleSubscription.updatedAt })
      .from(bundleSubscription)
      .orderBy(desc(bundleSubscription.updatedAt))
      .limit(limit),
  ]);

  const combined: RecentChange[] = [
    ...storeRows.map((r) => ({ ...r, axis: 'Store' as const, tier: r.tier })),
    ...listerRows.map((r) => ({ ...r, axis: 'Lister' as const, tier: r.tier })),
    ...automationRows.map((r) => ({ ...r, axis: 'Automation' as const, tier: 'ACTIVE' })),
    ...financeRows.map((r) => ({ ...r, axis: 'Finance' as const, tier: r.tier })),
    ...bundleRows.map((r) => ({ ...r, axis: 'Bundle' as const, tier: r.tier })),
  ]
    .map((r) => ({ ...r, userId: null as string | null, userName: null as string | null }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);

  // Resolve sellerProfile -> userId -> user name
  const sellerProfileIds = [...new Set(combined.map((r) => r.sellerProfileId))];
  if (sellerProfileIds.length === 0) return combined;

  const profiles = await db
    .select({ id: sellerProfile.id, userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(inArray(sellerProfile.id, sellerProfileIds));

  const profileMap = new Map(profiles.map((p) => [p.id, p.userId]));
  const userIds = [...new Set(profiles.map((p) => p.userId))];

  const users =
    userIds.length > 0
      ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return combined.map((r) => {
    const uid = profileMap.get(r.sellerProfileId) ?? null;
    return {
      ...r,
      userId: uid,
      userName: uid ? (userMap.get(uid) ?? null) : null,
    };
  });
}
