import { db } from '@twicely/db';
import { storefrontPage } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasStoreTier } from '@twicely/utils/tier-gates';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export interface ActionResult { success: boolean; error?: string }

export const EMPTY_PUCK_DATA = { content: [], root: { props: {} } };

// Page limits per tier — read from platform_settings
const DEFAULT_MAX_PAGES_POWER = 5;
const DEFAULT_MAX_PAGES_ENTERPRISE = 20;

export async function getMaxPages(storeTier: string): Promise<number> {
  if (hasStoreTier(storeTier, 'ENTERPRISE')) {
    return getPlatformSetting<number>('storefront.pages.maxEnterprise', DEFAULT_MAX_PAGES_ENTERPRISE);
  }
  if (hasStoreTier(storeTier, 'POWER')) {
    return getPlatformSetting<number>('storefront.pages.maxPower', DEFAULT_MAX_PAGES_POWER);
  }
  return 0;
}

/** Verify page belongs to the user's storefront. Returns page id or null. */
export async function verifyPageOwnership(
  pageId: string,
  storefrontId: string
): Promise<string | null> {
  const [page] = await db
    .select({ id: storefrontPage.id })
    .from(storefrontPage)
    .where(
      and(
        eq(storefrontPage.id, pageId),
        eq(storefrontPage.storefrontId, storefrontId)
      )
    )
    .limit(1);
  return page?.id ?? null;
}
