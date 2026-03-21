/**
 * Data Export BullMQ Job — G6
 *
 * Async job that collects all user data and uploads to R2.
 * Per Decision #110 (GDPR portability) and Feature Lock-in §37.
 * Max SLA: privacy.dataExportMaxHours (default 48 hours).
 *
 * Data collected:
 * - User profile
 * - Order history (buyer + seller)
 * - Listing history
 * - Payout history
 * - Ledger entries
 * - Messages
 * - Reviews written + received
 * - Watchlist items
 * - Notification preferences
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import {
  dataExportRequest,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { uploadToR2, R2_BUCKET_NAME } from '@twicely/storage/r2-client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { collectUserDataFull } from './data-export-full';

const QUEUE_NAME = 'data-export';

// Download URL TTL: 24 hours
const DOWNLOAD_URL_TTL_SECONDS = 24 * 60 * 60;

export interface DataExportJobData {
  requestId: string;
  userId: string;
  format: 'json' | 'csv';
}

export const dataExportQueue = createQueue<DataExportJobData>(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

function buildS3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKey || !secretKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}


function toCsv(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [section, rows] of Object.entries(data)) {
    if (Array.isArray(rows) && rows.length > 0) {
      lines.push(`## ${section}`);
      const headers = Object.keys(rows[0] as object);
      lines.push(headers.join(','));
      for (const row of rows) {
        lines.push(
          headers
            .map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? ''))
            .join(',')
        );
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function registerDataExportWorker(): void {
  createWorker<DataExportJobData>(QUEUE_NAME, async (job) => {
    const { requestId, userId, format } = job.data;

    logger.info('Data export job started', { requestId, userId, format });

    // Mark as PROCESSING
    await db
      .update(dataExportRequest)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(eq(dataExportRequest.id, requestId));

    try {
      // Use enhanced full export for GDPR Article 20 compliance
      const exportData = await collectUserDataFull(userId);

      const content =
        format === 'csv'
          ? toCsv(exportData)
          : JSON.stringify(exportData, null, 2);

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const key = `data-exports/${userId}/${requestId}.${format}`;

      const publicUrl = await uploadToR2(key, Buffer.from(content), contentType);

      // Generate signed download URL (24h TTL)
      const s3Client = buildS3Client();
      const downloadUrl = s3Client
        ? await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
            { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
          )
        : publicUrl;

      const downloadExpiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);

      await db
        .update(dataExportRequest)
        .set({
          status: 'COMPLETED',
          downloadUrl,
          downloadExpiresAt,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dataExportRequest.id, requestId));

      await notify(userId, 'privacy.data_export_ready', {
        expiresAt: downloadExpiresAt.toLocaleDateString(),
      });

      logger.info('Data export completed', { requestId, userId });
    } catch (err) {
      logger.error('Data export job failed', { requestId, userId, error: err });

      await db
        .update(dataExportRequest)
        .set({
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(dataExportRequest.id, requestId));

      throw err;
    }
  });
}
