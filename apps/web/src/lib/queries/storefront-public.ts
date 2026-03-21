import { db } from '@twicely/db';
import {
  sellerProfile,
  sellerPerformance,
  listing,
  listingImage,
  user,
  follow,
  storefront,
  storefrontCustomCategory,
} from '@twicely/db/schema';
import { eq, and, desc, asc, sql, inArray, ilike } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { mapToListingCard } from './shared';
import { getSellerLocalMetrics } from './local-metrics';
import type { ListingCardData } from '@/types/listings';
import type { SellerLocalMetrics } from './local-metrics';

// ─── Types ─────────────────────────────────────────────────────────────

export interface StorefrontBranding {
  bannerUrl: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  announcement: string | null;
  aboutHtml: string | null;
  socialLinks: Record<string, string>;
  featuredListingIds: string[];
  isStorePublished: boolean;
  defaultStoreView: string;
}

export interface StorefrontSeller {
  id: string;
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  storeDescription: string | null;
  returnPolicy: string | null;
  avatarUrl: string | null;
  performanceBand: string;
  memberSince: Date;
  vacationMode: boolean;
  vacationMessage: string | null;
  vacationModeType: string | null;
  vacationEndAt: Date | null;
  branding: StorefrontBranding;
}

export interface StorefrontStats {
  listingCount: number;
  followerCount: number;
  averageRating: number | null;
  totalReviews: number;
  // G2.17 — Local Seller Metrics
  localMetrics: SellerLocalMetrics | null;
}

export interface CustomCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface StorefrontData {
  seller: StorefrontSeller;
  stats: StorefrontStats;
  listings: ListingCardData[];
  featuredListings: ListingCardData[];
  customCategories: CustomCategory[];
  totalListings: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StorefrontQueryOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'newest' | 'price_low' | 'price_high';
  categorySlug?: string;
  searchQuery?: string;
}

// ─── Internal Types ─────────────────────────────────────────────────────

type SellerRow = {
  id: string; userId: string; storeName: string | null; storeSlug: string | null;
  storeDescription: string | null; returnPolicy: string | null; avatarUrl: string | null;
  performanceBand: string; memberSince: Date; vacationMode: boolean; vacationMessage: string | null;
  vacationModeType: string | null; vacationEndAt: Date | null;
  bannerUrl: string | null; logoUrl: string | null; accentColor: string | null;
  announcement: string | null; aboutHtml: string | null; socialLinksJson: unknown;
  featuredListingIds: string[] | null; isPublished: boolean; defaultView: string;
};

type PerfRow = { averageRating: number | null; totalReviews: number } | undefined;

function mapSellerRow(row: SellerRow): StorefrontSeller {
  return {
    id: row.id, userId: row.userId, storeName: row.storeName, storeSlug: row.storeSlug,
    storeDescription: row.storeDescription, returnPolicy: row.returnPolicy, avatarUrl: row.avatarUrl,
    performanceBand: row.performanceBand, memberSince: row.memberSince,
    vacationMode: row.vacationMode, vacationMessage: row.vacationMessage,
    vacationModeType: row.vacationModeType, vacationEndAt: row.vacationEndAt,
    branding: {
      bannerUrl: row.bannerUrl, logoUrl: row.logoUrl, accentColor: row.accentColor,
      announcement: row.announcement, aboutHtml: row.aboutHtml,
      socialLinks: (row.socialLinksJson ?? {}) as Record<string, string>,
      featuredListingIds: row.featuredListingIds ?? [],
      isStorePublished: row.isPublished, defaultStoreView: row.defaultView,
    },
  };
}

function buildEmptyResult(
  sellerRow: SellerRow, perfRow: PerfRow, customCategories: CustomCategory[], page: number, pageSize: number
): StorefrontData {
  return {
    seller: mapSellerRow(sellerRow),
    stats: { listingCount: 0, followerCount: 0, averageRating: perfRow?.averageRating ?? null, totalReviews: perfRow?.totalReviews ?? 0, localMetrics: null },
    listings: [], featuredListings: [], customCategories, totalListings: 0, page, pageSize, totalPages: 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

const listingSelectFields = (perfRow: PerfRow) => ({
  id: listing.id,
  slug: listing.slug,
  title: listing.title,
  priceCents: listing.priceCents,
  originalPriceCents: listing.originalPriceCents,
  condition: listing.condition,
  brand: listing.brand,
  freeShipping: listing.freeShipping,
  shippingCents: listing.shippingCents,
  primaryImageUrl: listingImage.url,
  primaryImageAlt: listingImage.altText,
  sellerName: user.name,
  sellerUsername: user.username,
  sellerAvatarUrl: user.avatarUrl,
  sellerAverageRating: sql<number | null>`${perfRow?.averageRating ?? null}`,
  sellerTotalReviews: sql<number>`${perfRow?.totalReviews ?? 0}`,
  sellerShowStars: sql<boolean>`true`,
  storefrontCategoryId: listing.storefrontCategoryId,
});

async function fetchCustomCategories(userId: string): Promise<CustomCategory[]> {
  const [storefrontRow] = await db
    .select({ id: storefront.id })
    .from(storefront)
    .where(eq(storefront.ownerUserId, userId))
    .limit(1);
  if (!storefrontRow) return [];
  const rows = await db
    .select()
    .from(storefrontCustomCategory)
    .where(eq(storefrontCustomCategory.storefrontId, storefrontRow.id))
    .orderBy(storefrontCustomCategory.sortOrder);
  return rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    sortOrder: cat.sortOrder,
  }));
}

// ─── Public Storefront (by slug) ───────────────────────────────────────

export async function getStorefrontBySlug(
  storeSlug: string,
  options: StorefrontQueryOptions = {}
): Promise<StorefrontData | null> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 24;
  const offset = (page - 1) * pageSize;

  // Get seller profile with user info and storefront branding
  const [sellerRow] = await db
    .select({
      id: sellerProfile.id, userId: sellerProfile.userId,
      storeName: sellerProfile.storeName, storeSlug: sellerProfile.storeSlug,
      storeDescription: sellerProfile.storeDescription, returnPolicy: sellerProfile.returnPolicy,
      performanceBand: sellerProfile.performanceBand, vacationMode: sellerProfile.vacationMode,
      vacationMessage: sellerProfile.vacationMessage,
      vacationModeType: sellerProfile.vacationModeType,
      vacationEndAt: sellerProfile.vacationEndAt,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt, bannerUrl: storefront.bannerUrl,
      logoUrl: storefront.logoUrl, accentColor: storefront.accentColor,
      announcement: storefront.announcement, aboutHtml: storefront.aboutHtml,
      socialLinksJson: storefront.socialLinksJson, featuredListingIds: storefront.featuredListingIds,
      isPublished: storefront.isPublished, defaultView: storefront.defaultView,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(sellerProfile.userId, user.id))
    .innerJoin(storefront, eq(storefront.ownerUserId, sellerProfile.userId))
    .where(eq(sellerProfile.storeSlug, storeSlug))
    .limit(1);

  if (!sellerRow || !sellerRow.isPublished) return null;

  const [perfRow] = await db
    .select({ averageRating: sellerPerformance.averageRating, totalReviews: sellerPerformance.totalReviews })
    .from(sellerPerformance)
    .where(eq(sellerPerformance.sellerProfileId, sellerRow.id))
    .limit(1);

  const customCategories = await fetchCustomCategories(sellerRow.userId);

  // Build filters
  let categoryFilter: SQL | undefined;
  if (options.categorySlug) {
    const matchedCategory = customCategories.find((cat) => cat.slug === options.categorySlug);
    if (matchedCategory) {
      categoryFilter = eq(listing.storefrontCategoryId, matchedCategory.id);
    } else {
      return buildEmptyResult(sellerRow, perfRow, customCategories, page, pageSize);
    }
  }
  const searchFilter = options.searchQuery?.trim()
    ? ilike(listing.title, `%${options.searchQuery.trim()}%`)
    : undefined;

  const baseConditions = and(
    eq(listing.ownerUserId, sellerRow.userId),
    eq(listing.status, 'ACTIVE'),
    categoryFilter,
    searchFilter
  );

  const [[listingCountRow], [followerCountRow], rawLocalMetrics] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(listing).where(baseConditions),
    db.select({ count: sql<number>`count(*)::int` }).from(follow).where(eq(follow.followedId, sellerRow.userId)),
    getSellerLocalMetrics(sellerRow.userId),
  ]);

  const sortClause = options.sortBy === 'price_low' ? asc(listing.priceCents)
    : options.sortBy === 'price_high' ? desc(listing.priceCents) : desc(listing.createdAt);

  const listingRows = await db
    .select(listingSelectFields(perfRow))
    .from(listing)
    .leftJoin(user, eq(listing.ownerUserId, user.id))
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .where(baseConditions)
    .orderBy(sortClause)
    .limit(pageSize)
    .offset(offset);

  // Featured listings (only on unfiltered main page)
  const featuredIds = sellerRow.featuredListingIds ?? [];
  let featuredListings: ListingCardData[] = [];
  if (featuredIds.length > 0 && !options.categorySlug && !options.searchQuery) {
    const featuredRows = await db
      .select(listingSelectFields(perfRow))
      .from(listing)
      .leftJoin(user, eq(listing.ownerUserId, user.id))
      .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
      .where(and(inArray(listing.id, featuredIds), eq(listing.status, 'ACTIVE')));
    featuredListings = featuredRows.map(mapToListingCard);
  }

  const localMetrics = rawLocalMetrics.hasLocalActivity ? rawLocalMetrics : null;
  const totalListings = listingCountRow?.count ?? 0;
  return {
    seller: mapSellerRow(sellerRow),
    stats: {
      listingCount: totalListings,
      followerCount: followerCountRow?.count ?? 0,
      averageRating: perfRow?.averageRating ?? null,
      totalReviews: perfRow?.totalReviews ?? 0,
      localMetrics,
    },
    listings: listingRows.map(mapToListingCard),
    featuredListings,
    customCategories,
    totalListings,
    page,
    pageSize,
    totalPages: Math.ceil(totalListings / pageSize),
  };
}
