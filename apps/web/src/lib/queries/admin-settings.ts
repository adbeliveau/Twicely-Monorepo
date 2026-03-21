/**
 * Admin Settings Queries (E3.6)
 * Platform settings CRUD — grouped by category
 */

import { db } from '@twicely/db';
import { platformSetting, platformSettingHistory, auditEvent } from '@twicely/db/schema';
import { eq, desc, asc, inArray } from 'drizzle-orm';

export interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  type: string;
  category: string;
  description: string | null;
  isSecret: boolean;
  updatedAt: Date;
}

const CATEGORY_ORDER = [
  'general',
  'environment',
  'integrations',
  'fees',
  'commerce',
  'fulfillment',
  'trust',
  'discovery',
  'comms',
  'payments',
  'privacy',
] as const;

export type SettingCategory = (typeof CATEGORY_ORDER)[number];

export function getSettingCategories(): readonly string[] {
  return CATEGORY_ORDER;
}

/**
 * Map granular seed categories to broad tab categories.
 * E.g. "commerce.tf" → "fees", "payout" → "payments", "boost" → "discovery"
 */
function normalizeCategory(cat: string): string {
  if (cat.startsWith('commerce.tf')) return 'fees';
  if (cat.startsWith('commerce.stripe')) return 'payments';
  if (cat.startsWith('commerce.shipping') || cat.startsWith('commerce.returns')) return 'fulfillment';
  if (cat.startsWith('commerce.escrow') || cat.startsWith('commerce.dispute') || cat.startsWith('commerce.local')) return 'commerce';
  if (cat === 'payout') return 'payments';
  if (cat === 'store' || cat === 'crosslister' || cat === 'finance' || cat === 'automation' ||
      cat === 'bundle' || cat === 'overage' || cat === 'auth') return 'fees';
  if (cat === 'boost') return 'discovery';
  if (cat === 'local') return 'commerce';
  if (cat === 'stripe') return 'payments';
  if (cat === 'featureFlags') return 'integrations';
  return cat;
}

export async function getSettingsByCategory(): Promise<Record<string, SettingRow[]>> {
  const rows = await db
    .select()
    .from(platformSetting)
    .orderBy(asc(platformSetting.category), asc(platformSetting.key));

  const grouped: Record<string, SettingRow[]> = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = [];
  }

  for (const row of rows) {
    const cat = normalizeCategory(row.category);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      category: row.category,
      description: row.description,
      isSecret: row.isSecret,
      updatedAt: row.updatedAt,
    });
  }

  return grouped;
}

export async function getSettingsByKeys(keys: string[]): Promise<SettingRow[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .select()
    .from(platformSetting)
    .where(inArray(platformSetting.key, keys))
    .orderBy(asc(platformSetting.key));

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    value: r.value,
    type: r.type,
    category: r.category,
    description: r.description,
    isSecret: r.isSecret,
    updatedAt: r.updatedAt,
  }));
}

export async function getSettingHistory(settingId: string, limit: number = 20) {
  return db
    .select()
    .from(platformSettingHistory)
    .where(eq(platformSettingHistory.settingId, settingId))
    .orderBy(desc(platformSettingHistory.createdAt))
    .limit(limit);
}

export interface SettingsOverview {
  totalSettings: number;
  customizedSettings: number;
  categoryBreakdown: Array<{ category: string; count: number; lastUpdatedAt: Date | null }>;
  recentChanges: Array<{
    id: string;
    settingKey: string;
    previousValue: unknown;
    newValue: unknown;
    changedByStaffId: string;
    reason: string | null;
    createdAt: Date;
  }>;
}

export async function getSettingsOverview(): Promise<SettingsOverview> {
  const [allSettings, recentHistory] = await Promise.all([
    db.select().from(platformSetting).orderBy(asc(platformSetting.category)),
    db
      .select({
        id: platformSettingHistory.id,
        settingId: platformSettingHistory.settingId,
        previousValue: platformSettingHistory.previousValue,
        newValue: platformSettingHistory.newValue,
        changedByStaffId: platformSettingHistory.changedByStaffId,
        reason: platformSettingHistory.reason,
        createdAt: platformSettingHistory.createdAt,
        settingKey: platformSetting.key,
      })
      .from(platformSettingHistory)
      .innerJoin(platformSetting, eq(platformSettingHistory.settingId, platformSetting.id))
      .orderBy(desc(platformSettingHistory.createdAt))
      .limit(10),
  ]);

  // Compute category breakdown
  const catMap = new Map<string, { count: number; lastUpdatedAt: Date | null }>();
  for (const s of allSettings) {
    const cat = normalizeCategory(s.category);
    const existing = catMap.get(cat);
    const updatedAt = s.updatedAt;
    if (!existing) {
      catMap.set(cat, { count: 1, lastUpdatedAt: updatedAt });
    } else {
      existing.count += 1;
      if (!existing.lastUpdatedAt || updatedAt > existing.lastUpdatedAt) {
        existing.lastUpdatedAt = updatedAt;
      }
    }
  }

  const categoryBreakdown = Array.from(catMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    lastUpdatedAt: data.lastUpdatedAt,
  }));

  // Customized = settings that have history entries
  const customizedIds = new Set(recentHistory.map((h) => h.settingId));
  const customizedSettings = customizedIds.size;

  return {
    totalSettings: allSettings.length,
    customizedSettings,
    categoryBreakdown,
    recentChanges: recentHistory.map((h) => ({
      id: h.id,
      settingKey: h.settingKey,
      previousValue: h.previousValue,
      newValue: h.newValue,
      changedByStaffId: h.changedByStaffId,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
  };
}

export async function getSettingHistoryAction(settingId: string) {
  return db
    .select()
    .from(platformSettingHistory)
    .where(eq(platformSettingHistory.settingId, settingId))
    .orderBy(desc(platformSettingHistory.createdAt))
    .limit(20);
}

export async function getRecentAuditEvents(
  opts: { actionPrefix: string; limit: number },
) {
  // We cannot do a LIKE in Drizzle without importing like — import at module level
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.subject, opts.actionPrefix))
    .orderBy(desc(auditEvent.createdAt))
    .limit(opts.limit);
}
