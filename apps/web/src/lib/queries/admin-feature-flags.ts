/**
 * Admin Feature Flag Queries (E4 + G10.4 + I16)
 * List, get by ID, get by key for feature flags.
 * Adds kill switch, launch gate, and regular flag partition queries.
 * I16: adds searchTerm filter to getPartitionedFlags.
 */

import { db } from '@twicely/db';
import { featureFlag } from '@twicely/db/schema';
import { eq, asc, ilike, or } from 'drizzle-orm';

export interface FeatureFlagRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: 'BOOLEAN' | 'PERCENTAGE' | 'TARGETED';
  enabled: boolean;
  percentage: number | null;
  targetingJson: unknown;
  createdByStaffId: string;
  createdAt: Date;
  updatedAt: Date;
}

function toRow(row: typeof featureFlag.$inferSelect): FeatureFlagRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    type: row.type,
    enabled: row.enabled,
    percentage: row.percentage ?? null,
    targetingJson: row.targetingJson,
    createdByStaffId: row.createdByStaffId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Return all feature flags ordered by key ascending, with optional search.
 */
export async function getFeatureFlags(searchTerm?: string): Promise<FeatureFlagRow[]> {
  const whereClause = searchTerm && searchTerm.trim()
    ? or(
        ilike(featureFlag.key, `%${searchTerm}%`),
        ilike(featureFlag.name, `%${searchTerm}%`)
      )
    : undefined;

  const rows = await db
    .select()
    .from(featureFlag)
    .where(whereClause)
    .orderBy(asc(featureFlag.key));

  return rows.map(toRow);
}

interface PartitionedFlags {
  killSwitches: FeatureFlagRow[];
  launchGates: FeatureFlagRow[];
  regularFlags: FeatureFlagRow[];
}

/**
 * Fetch all flags once and partition by key prefix.
 * Single DB query instead of three identical scans.
 * Optional searchTerm filters by key or name (case-insensitive).
 */
export async function getPartitionedFlags(searchTerm?: string): Promise<PartitionedFlags> {
  const all = await getFeatureFlags(searchTerm);
  const killSwitches: FeatureFlagRow[] = [];
  const launchGates: FeatureFlagRow[] = [];
  const regularFlags: FeatureFlagRow[] = [];

  for (const row of all) {
    if (row.key.startsWith('kill.')) killSwitches.push(row);
    else if (row.key.startsWith('gate.')) launchGates.push(row);
    else regularFlags.push(row);
  }

  return { killSwitches, launchGates, regularFlags };
}

/**
 * Return a single feature flag by ID, or null if not found.
 */
export async function getFeatureFlagById(id: string): Promise<FeatureFlagRow | null> {
  const [row] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.id, id))
    .limit(1);

  if (!row) return null;
  return toRow(row);
}

/**
 * Return a single feature flag by key, or null if not found.
 */
export async function getFeatureFlagByKey(key: string): Promise<FeatureFlagRow | null> {
  const [row] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .limit(1);

  if (!row) return null;
  return toRow(row);
}
