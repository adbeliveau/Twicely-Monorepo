/**
 * Admin Search Queries — OpenSearch Dashboard + Analytics (Decision #143)
 * Read-only queries for the /cfg/search/* admin surface.
 */

import { db } from '@twicely/db';
import {
  searchIndexVersion,
  searchIndexJob,
  searchQueryLog,
  searchSynonymSet,
  searchRule,
} from '@twicely/db/schema';
import { desc, eq, asc, sql, and, gte } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface SearchDashboardData {
  engine: string;
  dualWrite: boolean;
  gateEnabled: boolean;
  activeIndex: string | null;
  docCount: number;
  clusterHealth: { status: string; numberOfNodes: number; activeShards: number } | null;
  recentJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    totalItems: number | null;
    succeededItems: number | null;
    failedItems: number | null;
    createdAt: Date;
    completedAt: Date | null;
  }>;
}

export async function getSearchDashboard(): Promise<SearchDashboardData> {
  const [engine, dualWrite] = await Promise.all([
    getPlatformSetting<string>('search.engine', 'typesense'),
    getPlatformSetting<boolean>('search.opensearch.dualWrite', false),
  ]);

  // Active index from DB
  const activeVersions = await db
    .select()
    .from(searchIndexVersion)
    .where(eq(searchIndexVersion.isReadActive, true))
    .limit(1);

  const activeIndex = activeVersions[0]?.physicalIndexName ?? null;
  const docCount = activeVersions[0]?.docCount ?? 0;

  // Try to get live cluster health (best-effort)
  let clusterHealth: SearchDashboardData['clusterHealth'] = null;
  if (engine === 'opensearch') {
    try {
      const { getClusterHealth } = await import('@twicely/search/opensearch-admin');
      const health = await getClusterHealth();
      clusterHealth = {
        status: health.status,
        numberOfNodes: health.numberOfNodes,
        activeShards: health.activeShards,
      };
    } catch {
      // OpenSearch not reachable — show null
    }
  }

  // Recent jobs
  const recentJobs = await db
    .select()
    .from(searchIndexJob)
    .orderBy(desc(searchIndexJob.createdAt))
    .limit(5);

  // Check gate status from feature_flag table
  let gateEnabled = false;
  try {
    const { isFeatureEnabled } = await import('@twicely/config/feature-flags');
    gateEnabled = await isFeatureEnabled('gate.opensearch');
  } catch {
    // Feature flag module not available
  }

  return {
    engine,
    dualWrite,
    gateEnabled,
    activeIndex,
    docCount,
    clusterHealth,
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      jobType: j.jobType,
      status: j.status,
      totalItems: j.totalItems,
      succeededItems: j.succeededItems,
      failedItems: j.failedItems,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
    })),
  };
}

// ─── Indexes ──────────────────────────────────────────────────────────────

export async function getSearchIndexes() {
  return db
    .select()
    .from(searchIndexVersion)
    .orderBy(desc(searchIndexVersion.createdAt));
}

export async function getSearchJobs(limit = 20) {
  return db
    .select()
    .from(searchIndexJob)
    .orderBy(desc(searchIndexJob.createdAt))
    .limit(limit);
}

// ─── Synonyms ────────────────────────────────────────────────────────────

export async function getSearchSynonyms() {
  return db
    .select()
    .from(searchSynonymSet)
    .orderBy(asc(searchSynonymSet.name));
}

// ─── Rules ───────────────────────────────────────────────────────────────

export async function getSearchRules() {
  return db
    .select()
    .from(searchRule)
    .orderBy(desc(searchRule.priority), asc(searchRule.queryPattern));
}

// ─── Analytics ───────────────────────────────────────────────────────────

export interface SearchAnalyticsData {
  totalQueries: number;
  avgLatencyMs: number;
  zeroResultRate: number;
  topQueries: Array<{ query: string; count: number }>;
  engineBreakdown: Array<{ engine: string; count: number }>;
}

export async function getSearchAnalytics(days = 7): Promise<SearchAnalyticsData> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [totalResult, avgResult, zeroResult, topResult, engineResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchQueryLog)
      .where(gte(searchQueryLog.createdAt, since)),
    db
      .select({ avg: sql<number>`coalesce(avg(${searchQueryLog.latencyMs}), 0)::int` })
      .from(searchQueryLog)
      .where(gte(searchQueryLog.createdAt, since)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchQueryLog)
      .where(
        and(
          gte(searchQueryLog.createdAt, since),
          eq(searchQueryLog.resultCount, 0),
        ),
      ),
    db
      .select({
        query: searchQueryLog.normalizedQuery,
        count: sql<number>`count(*)::int`,
      })
      .from(searchQueryLog)
      .where(gte(searchQueryLog.createdAt, since))
      .groupBy(searchQueryLog.normalizedQuery)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    db
      .select({
        engine: searchQueryLog.engine,
        count: sql<number>`count(*)::int`,
      })
      .from(searchQueryLog)
      .where(gte(searchQueryLog.createdAt, since))
      .groupBy(searchQueryLog.engine),
  ]);

  const totalQueries = totalResult[0]?.count ?? 0;
  const avgLatencyMs = avgResult[0]?.avg ?? 0;
  const zeroResultCount = zeroResult[0]?.count ?? 0;

  return {
    totalQueries,
    avgLatencyMs,
    zeroResultRate: totalQueries > 0 ? zeroResultCount / totalQueries : 0,
    topQueries: topResult.map((r) => ({
      query: r.query ?? '(empty)',
      count: r.count,
    })),
    engineBreakdown: engineResult.map((r) => ({
      engine: r.engine,
      count: r.count,
    })),
  };
}
