'use server';

/**
 * Sync-related server actions for accounting integrations — G10.3
 * Covers: triggerAccountingSync, getAccountingSyncHistory,
 *         updateSyncFrequency, getAccountingSyncStatus.
 */

import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import {
  accountingIntegration,
  accountingSyncLog,
} from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { runFullSync } from '@/lib/accounting/sync-engine';
import { revalidatePath } from 'next/cache';

// ─── Local response types (mirrors accounting-integration.ts to avoid circular dep) ──

type TriggerSyncResponse =
  | { success: true; logId: string; recordsSynced: number; recordsFailed: number }
  | { success: false; error: string };

type SyncLogRow = {
  id: string;
  integrationId: string;
  syncType: string;
  status: string;
  recordsSynced: number;
  recordsFailed: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

type SyncHistoryResponse =
  | { success: true; logs: SyncLogRow[] }
  | { success: false; error: string };

type UpdateFrequencyResponse =
  | { success: true }
  | { success: false; error: string };

type SyncStatusResponse =
  | {
      success: true;
      status: string;
      lastSyncAt: Date | null;
      lastSyncStatus: string | null;
      syncErrorCount: number;
    }
  | { success: false; error: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve effective userId for delegation. */
function resolveUserId(
  session: { delegationId: string | null; onBehalfOfSellerId?: string | null; userId: string },
): string {
  return session.delegationId ? session.onBehalfOfSellerId! : session.userId;
}

const integrationIdSchema = z.object({ integrationId: z.string().cuid2() }).strict();

const updateFrequencySchema = z.object({
  integrationId: z.string().cuid2(),
  frequency: z.enum(['HOURLY', 'DAILY', 'MANUAL']),
}).strict();

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Trigger a full sync for an integration. Finance PRO required. */
export async function triggerAccountingSync(
  input: unknown,
): Promise<TriggerSyncResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('update', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to use accounting sync' };
  }

  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { integrationId } = parsed.data;

  // Verify ownership
  const [row] = await db
    .select({ id: accountingIntegration.id })
    .from(accountingIntegration)
    .where(
      and(
        eq(accountingIntegration.id, integrationId),
        eq(accountingIntegration.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return { success: false, error: 'Integration not found' };

  try {
    const result = await runFullSync(integrationId);
    revalidatePath('/my/selling/finances/integrations');
    if (!result.success) {
      return { success: false, error: 'Sync completed with errors' };
    }
    return {
      success: true,
      logId: result.logId,
      recordsSynced: result.recordsSynced,
      recordsFailed: result.recordsFailed,
    };
  } catch (error) {
    logger.error('[triggerAccountingSync] Failed', { integrationId, error: String(error) });
    return { success: false, error: 'Sync failed unexpectedly' };
  }
}

/** Return recent sync log entries for an integration. */
export async function getAccountingSyncHistory(
  input: unknown,
): Promise<SyncHistoryResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { integrationId } = parsed.data;

  // Verify ownership
  const [row] = await db
    .select({ id: accountingIntegration.id })
    .from(accountingIntegration)
    .where(
      and(
        eq(accountingIntegration.id, integrationId),
        eq(accountingIntegration.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return { success: false, error: 'Integration not found' };

  try {
    const logs = await db
      .select()
      .from(accountingSyncLog)
      .where(eq(accountingSyncLog.integrationId, integrationId))
      .orderBy(desc(accountingSyncLog.startedAt))
      .limit(20);

    return { success: true, logs: logs as SyncLogRow[] };
  } catch (error) {
    logger.error('[getAccountingSyncHistory] Failed', { integrationId, error: String(error) });
    return { success: false, error: 'Failed to load sync history' };
  }
}

/** Update the sync frequency for an integration. */
export async function updateSyncFrequency(
  input: unknown,
): Promise<UpdateFrequencyResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('update', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateFrequencySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { integrationId, frequency } = parsed.data;

  // Verify ownership
  const [row] = await db
    .select({ id: accountingIntegration.id })
    .from(accountingIntegration)
    .where(
      and(
        eq(accountingIntegration.id, integrationId),
        eq(accountingIntegration.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return { success: false, error: 'Integration not found' };

  try {
    await db
      .update(accountingIntegration)
      .set({ syncFrequency: frequency, updatedAt: new Date() })
      .where(eq(accountingIntegration.id, integrationId));

    revalidatePath('/my/selling/finances/integrations');
    return { success: true };
  } catch (error) {
    logger.error('[updateSyncFrequency] Failed', { integrationId, error: String(error) });
    return { success: false, error: 'Failed to update sync frequency' };
  }
}

/** Return the current sync status for an integration. */
export async function getAccountingSyncStatus(
  input: unknown,
): Promise<SyncStatusResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { integrationId } = parsed.data;

  try {
    const [row] = await db
      .select({
        status: accountingIntegration.status,
        lastSyncAt: accountingIntegration.lastSyncAt,
        lastSyncStatus: accountingIntegration.lastSyncStatus,
        syncErrorCount: accountingIntegration.syncErrorCount,
        userId: accountingIntegration.userId,
      })
      .from(accountingIntegration)
      .where(
        and(
          eq(accountingIntegration.id, integrationId),
          eq(accountingIntegration.userId, userId),
        ),
      )
      .limit(1);

    if (!row) return { success: false, error: 'Integration not found' };

    return {
      success: true,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      syncErrorCount: row.syncErrorCount,
    };
  } catch (error) {
    logger.error('[getAccountingSyncStatus] Failed', { integrationId, error: String(error) });
    return { success: false, error: 'Failed to load sync status' };
  }
}
