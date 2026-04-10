/**
 * AI Usage Logger
 *
 * Writes every AI call to the ai_usage_log table for observability.
 * Fire-and-forget — never blocks the caller on logging failures.
 * Aggregated monthly via getMonthlyUsage() for budget enforcement.
 */

import { db } from '@twicely/db';
import { aiUsageLog } from '@twicely/db/schema';
import { sql, gte } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import type { AiFeature } from './types';
import { estimateCostMicros } from './cost-estimator';

export interface UsageLogEntry {
  feature: AiFeature;
  userId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  error?: string;
}

/**
 * Log an AI usage event. Fire-and-forget — errors are swallowed and logged.
 */
export async function logUsage(entry: UsageLogEntry): Promise<void> {
  try {
    const costMicros = estimateCostMicros(entry.model, entry.inputTokens, entry.outputTokens);

    await db.insert(aiUsageLog).values({
      feature: entry.feature,
      userId: entry.userId ?? null,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      latencyMs: entry.latencyMs,
      cached: entry.cached,
      error: entry.error ?? null,
      costMicros,
    });

    logger.debug('[ai:usage] Logged', {
      feature: entry.feature,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costMicros,
      latencyMs: entry.latencyMs,
    });
  } catch (err) {
    // Fire-and-forget: never let logging failures propagate
    logger.error('[ai:usage] Failed to log usage', {
      feature: entry.feature,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface MonthlyUsage {
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

/**
 * Get aggregated AI usage for the current calendar month.
 * Used by budget enforcement to check against monthly caps.
 */
export async function getMonthlyUsage(): Promise<MonthlyUsage> {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [result] = await db
      .select({
        inputTokens: sql<number>`COALESCE(SUM(${aiUsageLog.inputTokens}), 0)`.mapWith(Number),
        outputTokens: sql<number>`COALESCE(SUM(${aiUsageLog.outputTokens}), 0)`.mapWith(Number),
        costMicros: sql<number>`COALESCE(SUM(${aiUsageLog.costMicros}), 0)`.mapWith(Number),
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart));

    return {
      inputTokens: result?.inputTokens ?? 0,
      outputTokens: result?.outputTokens ?? 0,
      costMicros: result?.costMicros ?? 0,
    };
  } catch (err) {
    logger.error('[ai:usage] Failed to get monthly usage', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { inputTokens: 0, outputTokens: 0, costMicros: 0 };
  }
}
