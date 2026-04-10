/**
 * Batch Processing Utility
 *
 * Processes bulk AI operations in configurable batches with concurrency
 * control and delay between batches (rate limit friendly).
 *
 * Used for: embedding generation for search index, nightly fraud scan, etc.
 */

import { logger } from '@twicely/logger';

export interface BatchRequest<T, R> {
  items: T[];
  processor: (batch: T[]) => Promise<R[]>;
  batchSize?: number;
  concurrency?: number;
  delayBetweenBatchesMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Split an array into chunks of a given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items in batches with concurrency control.
 *
 * @param req - Batch processing configuration
 * @returns All results in original order
 */
export async function processBatch<T, R>(req: BatchRequest<T, R>): Promise<R[]> {
  const batchSize = req.batchSize ?? 50;
  const concurrency = req.concurrency ?? 3;
  const delayMs = req.delayBetweenBatchesMs ?? 200;

  if (req.items.length === 0) return [];

  const batches = chunk(req.items, batchSize);
  const allResults: R[][] = new Array(batches.length);

  logger.debug('[ai:batch] Starting batch processing', {
    totalItems: req.items.length,
    batchCount: batches.length,
    batchSize,
    concurrency,
  });

  // Process batches with concurrency limit
  const concurrencyGroups = chunk(batches, concurrency);

  let batchIndex = 0;
  for (const group of concurrencyGroups) {
    const groupPromises = group.map(async (batch, groupIdx) => {
      const currentBatchIdx = batchIndex + groupIdx;
      try {
        const results = await req.processor(batch);
        allResults[currentBatchIdx] = results;
      } catch (err) {
        logger.error('[ai:batch] Batch failed', {
          batchIndex: currentBatchIdx,
          batchSize: batch.length,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });

    await Promise.all(groupPromises);
    batchIndex += group.length;

    // Delay between concurrency groups (not after the last one)
    if (batchIndex < batches.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  // Flatten results maintaining order
  const results: R[] = [];
  for (const batchResult of allResults) {
    if (batchResult) {
      results.push(...batchResult);
    }
  }

  logger.debug('[ai:batch] Batch processing complete', {
    totalResults: results.length,
    totalItems: req.items.length,
  });

  return results;
}
