import { db } from '@twicely/db';
import {
  sellerProfile,
  listing,
  listingImage,
  storefront,
  storefrontCustomCategory,
} from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { StorefrontBranding, CustomCategory } from './storefront-public';

// ─── Types ─────────────────────────────────────────────────────────────

export interface StorefrontOwnerData {
  id: string;
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  storeDescription: string | null;
  returnPolicy: string | null;
  handlingTimeDays: number;
  vacationMode: boolean;
  vacationMessage: string | null;
  vacationAutoReplyMessage: string | null;
  vacationModeType: string | null;
  vacationStartAt: Date | null;
  vacationEndAt: Date | null;
  branding: StorefrontBranding;
  customCategories: CustomCategory[];
}

// ─── Owner Storefront (for editing) ────────────────────────────────────

export async function getStorefrontForOwner(userId: string): Promise<StorefrontOwnerData | null> {
  const [row] = await db
    .select({
      id: sellerProfile.id,
      userId: sellerProfile.userId,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      storeDescription: sellerProfile.storeDescription,
      returnPolicy: sellerProfile.returnPolicy,
      handlingTimeDays: sellerProfile.handlingTimeDays,
      vacationMode: sellerProfile.vacationMode,
      vacationMessage: sellerProfile.vacationMessage,
      vacationAutoReplyMessage: sellerProfile.vacationAutoReplyMessage,
      vacationModeType: sellerProfile.vacationModeType,
      vacationStartAt: sellerProfile.vacationStartAt,
      vacationEndAt: sellerProfile.vacationEndAt,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!row) return null;

  // Get storefront branding and custom categories
  const [storefrontRow] = await db
    .select({
      id: storefront.id,
      bannerUrl: storefront.bannerUrl,
      logoUrl: storefront.logoUrl,
      accentColor: storefront.accentColor,
      announcement: storefront.announcement,
      aboutHtml: storefront.aboutHtml,
      socialLinksJson: storefront.socialLinksJson,
      featuredListingIds: storefront.featuredListingIds,
      isPublished: storefront.isPublished,
      defaultView: storefront.defaultView,
    })
    .from(storefront)
    .where(eq(storefront.ownerUserId, userId))
    .limit(1);

  let customCategories: CustomCategory[] = [];
  if (storefrontRow) {
    const categoryRows = await db
      .select()
      .from(storefrontCustomCategory)
      .where(eq(storefrontCustomCategory.storefrontId, storefrontRow.id))
      .orderBy(storefrontCustomCategory.sortOrder);

    customCategories = categoryRows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      sortOrder: cat.sortOrder,
    }));
  }

  return {
    id: row.id,
    userId: row.userId,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    storeDescription: row.storeDescription,
    returnPolicy: row.returnPolicy,
    handlingTimeDays: row.handlingTimeDays,
    vacationMode: row.vacationMode,
    vacationMessage: row.vacationMessage,
    vacationAutoReplyMessage: row.vacationAutoReplyMessage,
    vacationModeType: row.vacationModeType,
    vacationStartAt: row.vacationStartAt,
    vacationEndAt: row.vacationEndAt,
    branding: {
      bannerUrl: storefrontRow?.bannerUrl ?? null,
      logoUrl: storefrontRow?.logoUrl ?? null,
      accentColor: storefrontRow?.accentColor ?? null,
      announcement: storefrontRow?.announcement ?? null,
      aboutHtml: storefrontRow?.aboutHtml ?? null,
      socialLinks: (storefrontRow?.socialLinksJson ?? {}) as Record<string, string>,
      featuredListingIds: storefrontRow?.featuredListingIds ?? [],
      isStorePublished: storefrontRow?.isPublished ?? false,
      defaultStoreView: storefrontRow?.defaultView ?? 'GRID',
    },
    customCategories,
  };
}

// ─── Custom Categories CRUD ────────────────────────────────────────────

export async function getCustomCategories(userId: string) {
  const [storefrontRow] = await db
    .select({ id: storefront.id })
    .from(storefront)
    .where(eq(storefront.ownerUserId, userId))
    .limit(1);

  if (!storefrontRow) return [];

  return db
    .select()
    .from(storefrontCustomCategory)
    .where(eq(storefrontCustomCategory.storefrontId, storefrontRow.id))
    .orderBy(storefrontCustomCategory.sortOrder);
}

// ─── Seller Info for Page Gates ────────────────────────────────────────

export async function getSellerInfoForGates(userId: string) {
  const [row] = await db
    .select({
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

// ─── Listings for Featured Picker ──────────────────────────────────────

export async function getActiveListingsForPicker(userId: string) {
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      priceCents: listing.priceCents,
      imageUrl: listingImage.url,
    })
    .from(listing)
    .leftJoin(
      listingImage,
      and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true))
    )
    .where(and(eq(listing.ownerUserId, userId), eq(listing.status, 'ACTIVE')))
    .orderBy(desc(listing.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? 'Untitled',
    priceCents: r.priceCents ?? 0,
    imageUrl: r.imageUrl,
  }));
}
