import { db } from '@twicely/db';
import {
  storefront,
  storefrontPage,
  sellerProfile,
} from '@twicely/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { hasStoreTier } from '@twicely/utils/tier-gates';

// ─── Types ─────────────────────────────────────────────────────────────

export interface StorefrontPageListItem {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: Date;
}

export interface StorefrontPageEditorData {
  id: string;
  slug: string;
  title: string;
  puckData: unknown;
  isPublished: boolean;
  storefrontId: string;
}

export interface StorefrontPagePublicData {
  title: string;
  puckData: unknown;
  storeName: string | null;
  storeSlug: string;
}

export interface StorefrontPageNavItem {
  title: string;
  slug: string;
}

// ─── Query 1: Resolve userId → storefrontId ────────────────────────────

export async function getStorefrontIdForOwner(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: storefront.id })
    .from(storefront)
    .where(eq(storefront.ownerUserId, userId))
    .limit(1);
  return row?.id ?? null;
}

// ─── Query 2: All pages for owner (editor list) ────────────────────────

export async function getPagesForOwner(
  userId: string
): Promise<StorefrontPageListItem[]> {
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return [];

  const rows = await db
    .select({
      id: storefrontPage.id,
      slug: storefrontPage.slug,
      title: storefrontPage.title,
      isPublished: storefrontPage.isPublished,
      sortOrder: storefrontPage.sortOrder,
      updatedAt: storefrontPage.updatedAt,
    })
    .from(storefrontPage)
    .where(eq(storefrontPage.storefrontId, storefrontId))
    .orderBy(asc(storefrontPage.sortOrder));

  return rows;
}

// ─── Query 3: Single page for editor (ownership-verified) ──────────────

export async function getPageForEditor(
  userId: string,
  pageId: string
): Promise<StorefrontPageEditorData | null> {
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return null;

  const [row] = await db
    .select({
      id: storefrontPage.id,
      slug: storefrontPage.slug,
      title: storefrontPage.title,
      puckData: storefrontPage.puckData,
      isPublished: storefrontPage.isPublished,
      storefrontId: storefrontPage.storefrontId,
    })
    .from(storefrontPage)
    .where(
      and(
        eq(storefrontPage.id, pageId),
        eq(storefrontPage.storefrontId, storefrontId)
      )
    )
    .limit(1);

  return row ?? null;
}

// ─── Query 4: Public page by slug (with tier check) ────────────────────

export async function getPublishedPageBySlug(
  storeSlug: string,
  pageSlug: string
): Promise<
  | { upgradeRequired: true }
  | { upgradeRequired: false; page: StorefrontPagePublicData }
  | null
> {
  // Find the seller profile via store slug
  const [seller] = await db
    .select({
      userId: sellerProfile.userId,
      storeTier: sellerProfile.storeTier,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.storeSlug, storeSlug))
    .limit(1);

  if (!seller || !seller.storeSlug) return null;

  // Tier check: pages only render for POWER+
  if (!hasStoreTier(seller.storeTier, 'POWER')) {
    return { upgradeRequired: true };
  }

  // Find the storefront
  const storefrontId = await getStorefrontIdForOwner(seller.userId);
  if (!storefrontId) return null;

  // Find the published page
  const [page] = await db
    .select({
      title: storefrontPage.title,
      puckData: storefrontPage.puckData,
    })
    .from(storefrontPage)
    .where(
      and(
        eq(storefrontPage.storefrontId, storefrontId),
        eq(storefrontPage.slug, pageSlug),
        eq(storefrontPage.isPublished, true)
      )
    )
    .limit(1);

  if (!page) return null;

  return {
    upgradeRequired: false,
    page: {
      title: page.title,
      puckData: page.puckData,
      storeName: seller.storeName,
      storeSlug: seller.storeSlug,
    },
  };
}

// ─── Query 5: Published page nav items for StorefrontTabs ──────────────

export async function getPublishedPagesNav(
  storeSlug: string
): Promise<StorefrontPageNavItem[]> {
  // Find seller + check tier
  const [seller] = await db
    .select({
      userId: sellerProfile.userId,
      storeTier: sellerProfile.storeTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.storeSlug, storeSlug))
    .limit(1);

  if (!seller || !hasStoreTier(seller.storeTier, 'POWER')) return [];

  const storefrontId = await getStorefrontIdForOwner(seller.userId);
  if (!storefrontId) return [];

  const rows = await db
    .select({
      title: storefrontPage.title,
      slug: storefrontPage.slug,
    })
    .from(storefrontPage)
    .where(
      and(
        eq(storefrontPage.storefrontId, storefrontId),
        eq(storefrontPage.isPublished, true)
      )
    )
    .orderBy(asc(storefrontPage.sortOrder));

  return rows;
}
