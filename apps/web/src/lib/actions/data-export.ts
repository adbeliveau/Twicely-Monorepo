'use server';

/**
 * Data Export Server Actions — G6
 * Per Feature Lock-in §37 and Decision #110 (GDPR portability).
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { dataExportRequest } from '@twicely/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { dataExportQueue } from '@twicely/jobs/data-export';
import { logger } from '@twicely/logger';
import type { InferSelectModel } from 'drizzle-orm';

export type DataExportRequestRecord = InferSelectModel<typeof dataExportRequest>;

const RequestDataExportSchema = z.object({
  format: z.enum(['json', 'csv']),
});

const EXPORT_RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 1 per 24 hours

/**
 * Request a data export. Enforces 1-per-24h rate limit.
 * Creates a dataExportRequest record and enqueues a BullMQ job.
 */
export async function requestDataExport(
  input: z.infer<typeof RequestDataExportSchema>
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('create', sub('DataExportRequest', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = RequestDataExportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid format. Use json or csv.' };
  }

  const { userId } = session;
  const { format } = parsed.data;

  // Rate limit: check for any request in the last 24 hours
  const since = new Date(Date.now() - EXPORT_RATE_LIMIT_MS);
  const [recentRequest] = await db
    .select({ id: dataExportRequest.id, status: dataExportRequest.status })
    .from(dataExportRequest)
    .where(
      and(
        eq(dataExportRequest.userId, userId),
        gte(dataExportRequest.createdAt, since)
      )
    )
    .limit(1);

  if (recentRequest) {
    if (recentRequest.status === 'PENDING' || recentRequest.status === 'PROCESSING') {
      return { success: false, error: 'A data export is already in progress.' };
    }
    return {
      success: false,
      error: 'You can only request one data export per 24 hours.',
    };
  }

  const inserted = await db
    .insert(dataExportRequest)
    .values({ userId, format, status: 'PENDING' })
    .returning();

  const record = inserted[0];
  if (!record) {
    return { success: false, error: 'Failed to create export request.' };
  }

  // Enqueue BullMQ job
  await dataExportQueue.add('data-export', {
    requestId: record.id,
    userId,
    format,
  });

  logger.info('Data export requested', { userId, requestId: record.id, format });

  return { success: true, requestId: record.id };
}

/**
 * Returns the authenticated user's data export requests, most recent first.
 */
export async function getMyDataExportRequests(): Promise<DataExportRequestRecord[]> {
  const { session } = await authorize();
  if (!session) return [];

  return db
    .select()
    .from(dataExportRequest)
    .where(eq(dataExportRequest.userId, session.userId))
    .orderBy(desc(dataExportRequest.createdAt))
    .limit(20);
}

/**
 * Returns the download URL for a completed export (validates ownership + expiry).
 */
export async function downloadDataExport(
  requestId: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [record] = await db
    .select()
    .from(dataExportRequest)
    .where(
      and(
        eq(dataExportRequest.id, requestId),
        eq(dataExportRequest.userId, session.userId)
      )
    )
    .limit(1);

  if (!record) return { success: false, error: 'Not found' };

  if (!ability.can('read', sub('DataExportRequest', { userId: record.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  if (record.status !== 'COMPLETED') {
    return { success: false, error: 'Export is not ready yet.' };
  }

  if (!record.downloadUrl) {
    return { success: false, error: 'Download URL not available.' };
  }

  if (record.downloadExpiresAt && record.downloadExpiresAt < new Date()) {
    return { success: false, error: 'Download link has expired. Please request a new export.' };
  }

  return { success: true, downloadUrl: record.downloadUrl };
}
