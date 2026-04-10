import { db } from '@twicely/db';
import { bulkListingJob, listing } from '@twicely/db/schema';
import { eq, and, count, desc, inArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { BulkJobInput, PaginationInput, PaginatedResult } from './types';

interface BulkJobRow {
  id: string;
  sellerId: string;
  jobType: string;
  status: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errorLog: unknown;
  fileUrl: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Create a new bulk listing job.
 * Validates concurrent job limit from platform settings.
 */
export async function createBulkJob(
  sellerId: string,
  input: BulkJobInput
): Promise<{ id: string }> {
  const maxConcurrent = await getPlatformSetting<number>('seller.bulk.maxConcurrentJobs', 2);

  // Check active job count for this seller
  const [activeJobs] = await db
    .select({ count: count() })
    .from(bulkListingJob)
    .where(
      and(
        eq(bulkListingJob.sellerId, sellerId),
        inArray(bulkListingJob.status, ['PENDING', 'PROCESSING'])
      )
    );

  if ((activeJobs?.count ?? 0) >= maxConcurrent) {
    throw new Error('MAX_CONCURRENT_JOBS_REACHED');
  }

  const maxItems = await getPlatformSetting<number>('seller.bulk.maxItemsPerJob', 5000);
  if (input.totalItems && input.totalItems > maxItems) {
    throw new Error('MAX_ITEMS_PER_JOB_EXCEEDED');
  }

  const id = createId();
  await db.insert(bulkListingJob).values({
    id,
    sellerId,
    jobType: input.jobType,
    status: 'PENDING',
    totalItems: input.totalItems ?? 0,
    processedItems: 0,
    failedItems: 0,
    errorLog: null,
    fileUrl: input.fileUrl ?? null,
  });

  return { id };
}

/**
 * Process a bulk job: iterates items and updates progress.
 * In a real implementation this would process the actual file/listings;
 * here we implement the state machine and progress tracking.
 */
export async function processBulkJob(jobId: string): Promise<void> {
  // Set to PROCESSING
  const [job] = await db
    .update(bulkListingJob)
    .set({ status: 'PROCESSING' })
    .where(
      and(
        eq(bulkListingJob.id, jobId),
        eq(bulkListingJob.status, 'PENDING')
      )
    )
    .returning();

  if (!job) {
    throw new Error('JOB_NOT_FOUND_OR_NOT_PENDING');
  }

  const errors: Array<{ index: number; error: string }> = [];
  let processed = 0;
  let failed = 0;

  // Simulate processing items
  for (let i = 0; i < job.totalItems; i++) {
    processed++;
    // Update progress periodically
    if (processed % 100 === 0 || processed === job.totalItems) {
      await db
        .update(bulkListingJob)
        .set({
          processedItems: processed,
          failedItems: failed,
        })
        .where(eq(bulkListingJob.id, jobId));
    }
  }

  // Complete the job
  const finalStatus = failed === job.totalItems && job.totalItems > 0 ? 'FAILED' : 'COMPLETED';
  await db
    .update(bulkListingJob)
    .set({
      status: finalStatus,
      processedItems: processed,
      failedItems: failed,
      errorLog: errors.length > 0 ? errors : null,
      completedAt: new Date(),
    })
    .where(eq(bulkListingJob.id, jobId));
}

/**
 * Get all bulk jobs for a seller with pagination.
 */
export async function getBulkJobs(
  sellerId: string,
  pagination: PaginationInput = {}
): Promise<PaginatedResult<BulkJobRow>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(bulkListingJob)
    .where(eq(bulkListingJob.sellerId, sellerId));

  const items = await db
    .select({
      id: bulkListingJob.id,
      sellerId: bulkListingJob.sellerId,
      jobType: bulkListingJob.jobType,
      status: bulkListingJob.status,
      totalItems: bulkListingJob.totalItems,
      processedItems: bulkListingJob.processedItems,
      failedItems: bulkListingJob.failedItems,
      errorLog: bulkListingJob.errorLog,
      fileUrl: bulkListingJob.fileUrl,
      createdAt: bulkListingJob.createdAt,
      completedAt: bulkListingJob.completedAt,
    })
    .from(bulkListingJob)
    .where(eq(bulkListingJob.sellerId, sellerId))
    .orderBy(desc(bulkListingJob.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: items as unknown as BulkJobRow[],
    total: totalResult?.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Get a single bulk job by ID.
 */
export async function getBulkJob(id: string): Promise<BulkJobRow | null> {
  const [job] = await db
    .select({
      id: bulkListingJob.id,
      sellerId: bulkListingJob.sellerId,
      jobType: bulkListingJob.jobType,
      status: bulkListingJob.status,
      totalItems: bulkListingJob.totalItems,
      processedItems: bulkListingJob.processedItems,
      failedItems: bulkListingJob.failedItems,
      errorLog: bulkListingJob.errorLog,
      fileUrl: bulkListingJob.fileUrl,
      createdAt: bulkListingJob.createdAt,
      completedAt: bulkListingJob.completedAt,
    })
    .from(bulkListingJob)
    .where(eq(bulkListingJob.id, id))
    .limit(1);

  return (job as unknown as BulkJobRow) ?? null;
}

/**
 * Cancel a pending bulk job. Only PENDING jobs can be cancelled.
 */
export async function cancelBulkJob(id: string): Promise<void> {
  const [job] = await db
    .select({ status: bulkListingJob.status })
    .from(bulkListingJob)
    .where(eq(bulkListingJob.id, id))
    .limit(1);

  if (!job) {
    throw new Error('JOB_NOT_FOUND');
  }

  if (job.status !== 'PENDING') {
    throw new Error('ONLY_PENDING_JOBS_CAN_BE_CANCELLED');
  }

  await db
    .update(bulkListingJob)
    .set({
      status: 'FAILED',
      completedAt: new Date(),
    })
    .where(eq(bulkListingJob.id, id));
}
