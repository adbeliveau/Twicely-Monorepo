/**
 * Sitemap Pre-warm Cron Job — Canonical 21 §8.5
 *
 * Runs daily at 03:00 UTC to pre-warm sitemap caches.
 * Logs total URL counts for observability.
 */

import { createQueue, createWorker } from './queue';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const QUEUE_NAME = 'seo-sitemap-regenerate';

interface SitemapRegenerateData {
  triggeredAt: string;
}

export const sitemapRegenerateQueue = createQueue<SitemapRegenerateData>(QUEUE_NAME);

/** Regenerate all sitemaps to pre-warm cache. */
export async function regenerateSitemaps(): Promise<void> {
  const {
    generateSitemapIndex,
    generateStaticSitemap,
    generateCategorySitemap,
    generateListingSitemap,
    generateStoreSitemap,
  } = await import('@twicely/commerce/seo/sitemap');

  const [indexXml, staticXml, categoryXml, listingXml, storeXml] = await Promise.all([
    generateSitemapIndex(),
    generateStaticSitemap(),
    generateCategorySitemap(),
    generateListingSitemap(1),
    generateStoreSitemap(),
  ]);

  logger.info('[sitemap-regenerate] Pre-warm complete', {
    indexLength: indexXml.length,
    staticLength: staticXml.length,
    categoryLength: categoryXml.length,
    listing1Length: listingXml.length,
    storeLength: storeXml.length,
  });
}

/** Register the sitemap regeneration cron job. Call once at startup. */
export async function registerSitemapRegenerateJob(): Promise<void> {
  const cronPattern = await getPlatformSetting<string>(
    'seo.sitemap.regenerateCronPattern',
    '0 3 * * *',
  );

  await sitemapRegenerateQueue.add(
    'cron:sitemap-regenerate',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'cron-sitemap-regenerate',
      repeat: { pattern: cronPattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  createWorker<SitemapRegenerateData>(
    QUEUE_NAME,
    async () => {
      await regenerateSitemaps();
    },
    1,
  );
}
