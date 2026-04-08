'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { sellerProfile, storefront, storefrontCustomCategory, listing } from '@twicely/db/schema';
import { eq, and, ne, inArray, sql } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { createId } from '@paralleldrive/cuid2';
import { canUseFeature } from '@twicely/utils/tier-gates';
import { z } from 'zod';
import { sanitizeHtml } from '@twicely/utils/sanitize-html';

const updateStorefrontSettingsSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  storeSlug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/).optional(),
  storeDescription: z.string().max(2000).optional(),
  returnPolicy: z.string().max(5000).optional(),
  bannerUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  announcement: z.string().max(500).nullable().optional(),
  aboutHtml: z.string().max(10000).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  featuredListingIds: z.array(z.string().cuid2()).max(20).optional(),
  defaultStoreView: z.enum(['grid', 'list']).optional(),
  shippingPolicy: z.string().max(5000).nullable().optional(),
}).strict();

interface ActionResult { success: boolean; error?: string }

export const ACCENT_PALETTE = [
  '#7C3AED', '#2563EB', '#0891B2', '#059669',
  '#65A30D', '#CA8A04', '#EA580C', '#DC2626',
  '#DB2777', '#9333EA', '#4F46E5', '#475569',
] as const;

async function getSellerProfileForUser(userId: string) {
  const [row] = await db
    .select({
      id: sellerProfile.id,
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
      storeSlug: sellerProfile.storeSlug,
      storeName: sellerProfile.storeName,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

// ─── ACTION 1: updateStorefrontSettings ────────────────────────────────
export async function updateStorefrontSettings(data: {
  storeName?: string;
  storeSlug?: string;
  storeDescription?: string;
  returnPolicy?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  announcement?: string | null;
  aboutHtml?: string | null;
  socialLinks?: Record<string, string>;
  featuredListingIds?: string[];
  defaultStoreView?: 'grid' | 'list';
  shippingPolicy?: string | null;
}): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateStorefrontSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };

  // Fields that stay on sellerProfile
  const profileUpdates: Record<string, unknown> = {};
  // Fields that belong on storefront (branding)
  const brandingUpdates: Record<string, unknown> = {};

  if (data.storeName !== undefined) {
    if (data.storeName.length < 3 || data.storeName.length > 50)
      return { success: false, error: 'Store name must be 3-50 characters' };
    profileUpdates.storeName = data.storeName;
  }

  if (data.storeSlug !== undefined) {
    const slug = data.storeSlug.toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug))
      return { success: false, error: 'Slug: 3-30 chars, lowercase alphanumeric + hyphens' };
    const [existing] = await db.select({ id: sellerProfile.id }).from(sellerProfile)
      .where(and(eq(sellerProfile.storeSlug, slug), ne(sellerProfile.id, profile.id))).limit(1);
    if (existing) return { success: false, error: 'This store URL is already taken' };
    profileUpdates.storeSlug = slug;
  }

  if (data.storeDescription !== undefined) profileUpdates.storeDescription = data.storeDescription;
  if (data.returnPolicy !== undefined) profileUpdates.returnPolicy = data.returnPolicy;

  if (data.shippingPolicy !== undefined) {
    if (data.shippingPolicy && data.shippingPolicy.length > 2000)
      return { success: false, error: 'Shipping policy max 2000 characters' };
    brandingUpdates.shippingPolicy = data.shippingPolicy;
  }
  if (data.bannerUrl !== undefined) brandingUpdates.bannerUrl = data.bannerUrl;
  if (data.logoUrl !== undefined) brandingUpdates.logoUrl = data.logoUrl;

  if (data.accentColor !== undefined) {
    if (data.accentColor !== null && !ACCENT_PALETTE.includes(data.accentColor as typeof ACCENT_PALETTE[number]))
      return { success: false, error: 'Invalid accent color' };
    brandingUpdates.accentColor = data.accentColor;
  }

  if (data.announcement !== undefined) {
    if (!canUseFeature(profile.storeTier, 'announcement'))
      return { success: false, error: 'Announcement bar requires Starter plan or higher' };
    if (data.announcement && data.announcement.length > 200)
      return { success: false, error: 'Announcement max 200 characters' };
    brandingUpdates.announcement = data.announcement;
  }

  if (data.aboutHtml !== undefined) {
    if (data.aboutHtml && data.aboutHtml.length > 2000)
      return { success: false, error: 'About section max 2000 characters' };
    // SEC-032: Sanitize at write time (defense-in-depth alongside client DOMPurify)
    brandingUpdates.aboutHtml = data.aboutHtml ? sanitizeHtml(data.aboutHtml) : data.aboutHtml;
  }

  if (data.socialLinks !== undefined) {
    if (!canUseFeature(profile.storeTier, 'socialLinks'))
      return { success: false, error: 'Social links require Starter plan or higher' };
    for (const [, url] of Object.entries(data.socialLinks)) {
      if (url && !/^https?:\/\/.+/.test(url))
        return { success: false, error: 'Social links must be valid URLs starting with http(s)://' };
    }
    brandingUpdates.socialLinksJson = data.socialLinks;
  }

  if (data.featuredListingIds !== undefined) {
    if (data.featuredListingIds.length > 6)
      return { success: false, error: 'Maximum 6 featured listings' };
    if (data.featuredListingIds.length > 0) {
      const listings = await db.select({ id: listing.id }).from(listing)
        .where(and(inArray(listing.id, data.featuredListingIds), eq(listing.ownerUserId, userId), eq(listing.status, 'ACTIVE')));
      if (listings.length !== data.featuredListingIds.length)
        return { success: false, error: 'All featured listings must be active and owned by you' };
    }
    brandingUpdates.featuredListingIds = data.featuredListingIds;
  }

  if (data.defaultStoreView !== undefined) {
    if (!['grid', 'list'].includes(data.defaultStoreView))
      return { success: false, error: 'Default view must be grid or list' };
    brandingUpdates.defaultView = data.defaultStoreView.toUpperCase();
  }

  if (Object.keys(profileUpdates).length === 0 && Object.keys(brandingUpdates).length === 0)
    return { success: false, error: 'No fields to update' };

  if (Object.keys(profileUpdates).length > 0) {
    profileUpdates.updatedAt = new Date();
    await db.update(sellerProfile).set(profileUpdates).where(eq(sellerProfile.userId, userId));
  }

  if (Object.keys(brandingUpdates).length > 0) {
    brandingUpdates.updatedAt = new Date();
    await db.update(storefront).set(brandingUpdates).where(eq(storefront.ownerUserId, userId));
  }

  const slug = (data.storeSlug ?? profile.storeSlug) || '';
  revalidatePath('/my/selling/store');
  if (slug) revalidatePath(`/st/${slug}`);
  return { success: true };
}

// ─── ACTION 2: publishStorefront ───────────────────────────────────────
// Three gates: BUSINESS seller + store name set + at least 1 active listing
export async function publishStorefront(): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required to publish store' };
  if (!profile.storeName) return { success: false, error: 'Store name is required before publishing' };
  if (!profile.storeSlug) return { success: false, error: 'Store URL is required before publishing' };

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(listing)
    .where(and(eq(listing.ownerUserId, userId), eq(listing.status, 'ACTIVE')));
  if ((countRow?.count ?? 0) === 0)
    return { success: false, error: 'At least 1 active listing required before publishing' };

  await db.update(storefront).set({ isPublished: true, updatedAt: new Date() })
    .where(eq(storefront.ownerUserId, userId));
  revalidatePath('/my/selling/store');
  revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}

// ─── ACTION 3: unpublishStorefront ─────────────────────────────────────
export async function unpublishStorefront(): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const profile = await getSellerProfileForUser(userId);
  await db.update(storefront).set({ isPublished: false, updatedAt: new Date() })
    .where(eq(storefront.ownerUserId, userId));
  revalidatePath('/my/selling/store');
  if (profile?.storeSlug) revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}

// ─── ACTION 4: updateStoreCategories ───────────────────────────────────
const updateCategoriesSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().min(0),
  }).strict()).max(20),
}).strict();

export async function updateStoreCategories(
  categories: { name: string; sortOrder: number }[]
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateCategoriesSchema.safeParse({ categories });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (!canUseFeature(profile.storeTier, 'customCategories'))
    return { success: false, error: 'Custom categories require Pro plan or higher' };

  let [storefrontRow] = await db.select({ id: storefront.id }).from(storefront)
    .where(eq(storefront.ownerUserId, userId)).limit(1);

  if (!storefrontRow) {
    const newStorefrontId = createId();
    await db.insert(storefront).values({ id: newStorefrontId, ownerUserId: userId });
    storefrontRow = { id: newStorefrontId };
  }

  await db.delete(storefrontCustomCategory).where(eq(storefrontCustomCategory.storefrontId, storefrontRow.id));

  if (parsed.data.categories.length > 0) {
    await db.insert(storefrontCustomCategory).values(
      parsed.data.categories.map((cat) => ({
        id: createId(),
        storefrontId: storefrontRow.id,
        name: cat.name,
        description: null,
        sortOrder: cat.sortOrder,
      }))
    );
  }

  revalidatePath('/my/selling/store');
  return { success: true };
}
