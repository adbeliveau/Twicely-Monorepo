'use server';

/**
 * Server actions for accounting integrations — G10.3
 */

import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { accountingIntegration, accountingEntityMap } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/** Resolve effective userId for delegation. */
function resolveUserId(
  session: { delegationId: string | null; onBehalfOfSellerId?: string | null; userId: string },
): string {
  return session.delegationId ? session.onBehalfOfSellerId! : session.userId;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrationRow = {
  id: string;
  provider: string;
  status: string;
  externalAccountId: string | null;
  companyName: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  syncFrequency: string | null;
  syncErrorCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncLogRow = {
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

export type GetIntegrationsResponse =
  | { success: true; integrations: IntegrationRow[] }
  | { success: false; error: string };

export type DisconnectResponse =
  | { success: true }
  | { success: false; error: string };

export type TriggerSyncResponse =
  | { success: true; logId: string; recordsSynced: number; recordsFailed: number }
  | { success: false; error: string };

export type SyncHistoryResponse =
  | { success: true; logs: SyncLogRow[] }
  | { success: false; error: string };

export type UpdateFrequencyResponse =
  | { success: true }
  | { success: false; error: string };

export type SyncStatusResponse =
  | {
      success: true;
      status: string;
      lastSyncAt: Date | null;
      lastSyncStatus: string | null;
      syncErrorCount: number;
    }
  | { success: false; error: string };

// ─── Validation schemas ───────────────────────────────────────────────────────

const integrationIdSchema = z.object({ integrationId: z.string().cuid2() }).strict();

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Return all accounting integrations for the current user. Tokens are NOT returned. */
export async function getAccountingIntegrations(): Promise<GetIntegrationsResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const rows = await db
      .select({
        id: accountingIntegration.id,
        provider: accountingIntegration.provider,
        status: accountingIntegration.status,
        externalAccountId: accountingIntegration.externalAccountId,
        companyName: accountingIntegration.companyName,
        lastSyncAt: accountingIntegration.lastSyncAt,
        lastSyncStatus: accountingIntegration.lastSyncStatus,
        syncFrequency: accountingIntegration.syncFrequency,
        syncErrorCount: accountingIntegration.syncErrorCount,
        createdAt: accountingIntegration.createdAt,
        updatedAt: accountingIntegration.updatedAt,
      })
      .from(accountingIntegration)
      .where(eq(accountingIntegration.userId, userId));

    return { success: true, integrations: rows };
  } catch (error) {
    logger.error('[getAccountingIntegrations] Failed', { error: String(error) });
    return { success: false, error: 'Failed to load integrations' };
  }
}

/** Disconnect an accounting integration and clear tokens + entity mappings. */
export async function disconnectAccountingIntegration(
  input: unknown,
): Promise<DisconnectResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('delete', sub('AccountingIntegration', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { integrationId } = parsed.data;

  try {
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

    // Delete entity mappings
    await db
      .delete(accountingEntityMap)
      .where(eq(accountingEntityMap.integrationId, integrationId));

    // Set status to DISCONNECTED and clear tokens
    await db
      .update(accountingIntegration)
      .set({
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(eq(accountingIntegration.id, integrationId));

    revalidatePath('/my/selling/finances/integrations');
    return { success: true };
  } catch (error) {
    logger.error('[disconnectAccountingIntegration] Failed', {
      integrationId,
      error: String(error),
    });
    return { success: false, error: 'Failed to disconnect integration' };
  }
}
