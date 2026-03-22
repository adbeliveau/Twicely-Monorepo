'use server';

/**
 * Admin Data Retention Server Actions — G6
 * ADMIN role required for all actions.
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { user as userTable, dataExportRequest, auditEvent } from '@twicely/db/schema';
import { eq, isNotNull, desc, and, gte, count, inArray } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { ForbiddenError } from '@twicely/casl';
import { getPlatformSettingsByPrefix, getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { InferSelectModel } from 'drizzle-orm';

export interface RetentionPolicyEntry {
  key: string;
  label: string;
  value: unknown;
}

export interface DeletionQueueEntry {
  userId: string;
  name: string;
  emailMasked: string;
  deletionRequestedAt: Date;
  deletionDate: Date;
  daysRemaining: number;
}

/**
 * Returns current retention policy settings and stats.
 * Readable by any staff role.
 */
export async function getRetentionDashboard(): Promise<{
  policies: RetentionPolicyEntry[];
}> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    throw new ForbiddenError('Access denied');
  }

  const settingsMap = await getPlatformSettingsByPrefix('privacy.retention.');
  const gdprMap = await getPlatformSettingsByPrefix('privacy.gdpr.');

  const policies: RetentionPolicyEntry[] = [
    { key: 'privacy.retention.messageDays', label: 'Message retention (days)', value: settingsMap.get('privacy.retention.messageDays') ?? 730 },
    { key: 'privacy.retention.searchLogDays', label: 'Search log retention (days)', value: settingsMap.get('privacy.retention.searchLogDays') ?? 90 },
    { key: 'privacy.retention.auditLogDays', label: 'Audit log retention (days)', value: settingsMap.get('privacy.retention.auditLogDays') ?? 2555 },
    { key: 'privacy.retention.webhookLogDays', label: 'Webhook log retention (days)', value: settingsMap.get('privacy.retention.webhookLogDays') ?? 90 },
    { key: 'privacy.retention.analyticsEventDays', label: 'Analytics event retention (days)', value: settingsMap.get('privacy.retention.analyticsEventDays') ?? 365 },
    { key: 'privacy.retention.notificationLogDays', label: 'Notification log retention (days)', value: settingsMap.get('privacy.retention.notificationLogDays') ?? 180 },
    { key: 'privacy.gdpr.deletionGracePeriodDays', label: 'Deletion cooling-off (days)', value: gdprMap.get('privacy.gdpr.deletionGracePeriodDays') ?? 30 },
  ];

  return { policies };
}

/**
 * Returns users currently in the deletion cooling-off period.
 * PII is masked in the response per Actors & Security Canonical §4.
 */
export async function getDeletionQueue(): Promise<DeletionQueueEntry[]> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    throw new ForbiddenError('Access denied');
  }

  const gracePeriodDays = await getPlatformSetting<number>(
    'privacy.gdpr.deletionGracePeriodDays',
    30
  );

  const pendingUsers = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      deletionRequestedAt: userTable.deletionRequestedAt,
    })
    .from(userTable)
    .where(isNotNull(userTable.deletionRequestedAt))
    .orderBy(desc(userTable.deletionRequestedAt))
    .limit(100);

  const now = new Date();
  return pendingUsers
    .filter((u): u is typeof u & { deletionRequestedAt: Date } =>
      u.deletionRequestedAt !== null
    )
    .map((u) => {
    const requestedAt = u.deletionRequestedAt;
    const deletionDate = new Date(requestedAt.getTime() + gracePeriodDays * 86400000);
    const daysRemaining = Math.max(
      0,
      Math.ceil((deletionDate.getTime() - now.getTime()) / 86400000)
    );

    // Mask PII
    const atIdx = u.email.indexOf('@');
    const emailMasked =
      atIdx > 0
        ? `${u.email[0]}***@${u.email.slice(atIdx + 1)}`
        : '***@***';

    return {
      userId: u.id,
      name: u.name.charAt(0) + '***',
      emailMasked,
      deletionRequestedAt: requestedAt,
      deletionDate,
      daysRemaining,
    };
  });
}

const ForceDeleteSchema = z.object({
  userId: z.string().cuid2(),
});

/**
 * Admin force-complete deletion (skips remaining cooling-off).
 * Requires ADMIN role. Creates CRITICAL audit event.
 */
export async function forceCompleteDeletion(
  input: z.infer<typeof ForceDeleteSchema>
): Promise<{ success: boolean; error?: string }> {
  const { session, ability } = await staffAuthorize();

  if (!ability.can('manage', 'DataRetention')) {
    throw new ForbiddenError('ADMIN role required');
  }

  const parsed = ForceDeleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { userId } = parsed.data;

  const [targetUser] = await db
    .select({ id: userTable.id, deletionRequestedAt: userTable.deletionRequestedAt })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!targetUser) return { success: false, error: 'User not found' };
  if (!targetUser.deletionRequestedAt) {
    return { success: false, error: 'User has not requested deletion' };
  }

  // Log CRITICAL audit event before deletion
  await db.insert(auditEvent).values({
    actorId: session.staffUserId,
    actorType: 'STAFF',
    action: 'FORCE_COMPLETE_DELETION',
    subject: 'User',
    subjectId: userId,
    severity: 'CRITICAL',
    detailsJson: { triggeredBy: 'admin_force_delete' },
  });

  // Set deletionRequestedAt to far in the past to trigger immediate deletion pipeline
  await db
    .update(userTable)
    .set({ deletionRequestedAt: new Date('2000-01-01') })
    .where(eq(userTable.id, userId));

  logger.info('Force deletion initiated by staff', {
    targetUserId: userId,
    staffId: session.staffUserId,
  });

  return { success: true };
}

/**
 * Returns all data export requests (admin view, most recent first).
 */
export async function getDataExportRequests(): Promise<
  InferSelectModel<typeof dataExportRequest>[]
> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataExportRequest')) {
    throw new ForbiddenError('Access denied');
  }

  return db
    .select()
    .from(dataExportRequest)
    .orderBy(desc(dataExportRequest.createdAt))
    .limit(200);
}

export interface GdprComplianceSummary {
  activeDeletionRequests: number;
  completedDeletionsLast30Days: number;
  pendingDataExports: number;
  completedExportsLast30Days: number;
  failedExportsRequiringAttention: number;
}

/**
 * Returns GDPR compliance summary counts for the admin dashboard.
 * Per G8.4 spec.
 */
export async function getGdprComplianceSummary(): Promise<GdprComplianceSummary> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    throw new ForbiddenError('Access denied');
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    activeDeletions,
    completedDeletions,
    pendingExports,
    completedExports,
    failedExports,
  ] = await Promise.all([
    db.select({ c: count() }).from(userTable).where(isNotNull(userTable.deletionRequestedAt)),
    db.select({ c: count() }).from(auditEvent).where(
      and(
        eq(auditEvent.action, 'ACCOUNT_DELETION_EXECUTED'),
        gte(auditEvent.createdAt, thirtyDaysAgo)
      )
    ),
    db.select({ c: count() }).from(dataExportRequest).where(
      inArray(dataExportRequest.status, ['PENDING', 'PROCESSING'])
    ),
    db.select({ c: count() }).from(dataExportRequest).where(
      and(
        inArray(dataExportRequest.status, ['COMPLETED']),
        gte(dataExportRequest.completedAt, thirtyDaysAgo)
      )
    ),
    db.select({ c: count() }).from(dataExportRequest).where(
      inArray(dataExportRequest.status, ['FAILED'])
    ),
  ]);

  return {
    activeDeletionRequests: activeDeletions[0]?.c ?? 0,
    completedDeletionsLast30Days: completedDeletions[0]?.c ?? 0,
    pendingDataExports: pendingExports[0]?.c ?? 0,
    completedExportsLast30Days: completedExports[0]?.c ?? 0,
    failedExportsRequiringAttention: failedExports[0]?.c ?? 0,
  };
}

export interface RetentionJobStatus {
  sessionCleanup: { lastRunAt: string | null; lastResult: string | null };
  auditArchive: { lastRunAt: string | null; lastResult: string | null };
  dataPurge: { lastRunAt: string | null; lastResult: string | null };
  accountDeletion: { lastRunAt: string | null; lastResult: string | null };
}

/**
 * Returns last-run timestamps and results for all cleanup cron jobs.
 * Reads from platform_settings keys updated by each job on completion.
 */
export async function getRetentionJobStatus(): Promise<RetentionJobStatus> {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    throw new ForbiddenError('Access denied');
  }

  const cleanupMap = await getPlatformSettingsByPrefix('cleanup.');

  function getStr(key: string): string | null {
    const v = cleanupMap.get(key);
    return v != null ? String(v) : null;
  }

  return {
    sessionCleanup: {
      lastRunAt: getStr('cleanup.sessionCleanup.lastRunAt'),
      lastResult: getStr('cleanup.sessionCleanup.lastResult'),
    },
    auditArchive: {
      lastRunAt: getStr('cleanup.auditArchive.lastRunAt'),
      lastResult: getStr('cleanup.auditArchive.lastResult'),
    },
    dataPurge: {
      lastRunAt: getStr('cleanup.dataPurge.lastRunAt'),
      lastResult: getStr('cleanup.dataPurge.lastResult'),
    },
    accountDeletion: {
      lastRunAt: getStr('cleanup.accountDeletion.lastRunAt'),
      lastResult: getStr('cleanup.accountDeletion.lastResult'),
    },
  };
}
