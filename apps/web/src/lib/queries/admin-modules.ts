/**
 * Admin Module Queries (F1.3)
 * Module registry CRUD
 */

import { db } from '@twicely/db';
import { moduleRegistry } from '@twicely/db/schema';
import { eq, count, sql } from 'drizzle-orm';

export interface ModuleRow {
  id: string;
  moduleId: string;
  label: string;
  description: string | null;
  state: 'ENABLED' | 'DISABLED' | 'BETA' | 'DEPRECATED';
  version: string;
  configPath: string | null;
  manifestJson: unknown;
  installedAt: Date;
  updatedAt: Date;
}

export interface ModuleStats {
  total: number;
  enabled: number;
  disabled: number;
}

export async function getModules(stateFilter?: string): Promise<ModuleRow[]> {
  const query = db.select().from(moduleRegistry);

  if (stateFilter && stateFilter !== 'all') {
    return db
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.state, stateFilter as 'ENABLED' | 'DISABLED' | 'BETA' | 'DEPRECATED'));
  }

  return query;
}

export async function getModuleStats(): Promise<ModuleStats> {
  const [result] = await db
    .select({
      total: count(),
      enabled: count(sql`CASE WHEN ${moduleRegistry.state} = 'ENABLED' THEN 1 END`),
      disabled: count(sql`CASE WHEN ${moduleRegistry.state} = 'DISABLED' THEN 1 END`),
    })
    .from(moduleRegistry);

  return {
    total: result?.total ?? 0,
    enabled: result?.enabled ?? 0,
    disabled: result?.disabled ?? 0,
  };
}

export async function getModuleById(moduleId: string): Promise<ModuleRow | null> {
  const [row] = await db
    .select()
    .from(moduleRegistry)
    .where(eq(moduleRegistry.moduleId, moduleId))
    .limit(1);

  return row ?? null;
}
