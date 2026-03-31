'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { storefront, storefrontPage } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { canUseFeature } from '@twicely/utils/tier-gates';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import {
  type ActionResult,
  EMPTY_PUCK_DATA,
  getMaxPages,
  verifyPageOwnership,
} from './storefront-pages-helpers';
import { getSellerProfile as getSellerProfileForUser } from '@/lib/queries/seller';
import { getStorefrontIdForOwner } from '@/lib/queries/storefront-pages';

// ─── Zod Schemas ────────────────────────────────────────────────────────

const createPageSchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug: lowercase alphanumeric + hyphens, 2-50 chars'
  ),
}).strict();

// Validate Puck data structure — only allow known block types to prevent injection
const KNOWN_PUCK_BLOCKS = [
  'HeroBlock', 'RichTextBlock', 'ImageBlock', 'VideoEmbedBlock', 'ImageGalleryBlock',
  'CtaButtonBlock', 'FaqBlock', 'TestimonialBlock', 'ColumnsBlock', 'SpacerBlock',
  'FeaturedListingsBlock', 'CategoryGridBlock', 'NewsletterBlock',
] as const;

const puckBlockSchema = z.object({
  type: z.enum(KNOWN_PUCK_BLOCKS),
  props: z.record(z.string(), z.unknown()),
}).passthrough();

const puckDataSchema = z.object({
  content: z.array(puckBlockSchema).optional(),
  root: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const savePuckDataSchema = z.object({
  pageId: zodId,
  puckData: puckDataSchema,
}).strict();

const reorderPagesSchema = z.object({
  pageIds: z.array(zodId),
}).strict();

// ─── ACTION 1: createPage ───────────────────────────────────────────────

export async function createPage(
  data: { title: string; slug: string }
): Promise<ActionResult & { pageId?: string }> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };
  if (!canUseFeature(profile.storeTier, 'puckEditor'))
    return { success: false, error: 'Page builder requires Power plan or higher' };

  const parsed = createPageSchema.safeParse(data);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  let storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) {
    const newId = createId();
    await db.insert(storefront).values({ id: newId, ownerUserId: userId });
    storefrontId = newId;
  }

  // Page limit check
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(storefrontPage)
    .where(eq(storefrontPage.storefrontId, storefrontId));
  if ((countRow?.count ?? 0) >= await getMaxPages(profile.storeTier))
    return { success: false, error: 'Page limit reached for your tier' };

  // Unique slug check
  const [existing] = await db
    .select({ id: storefrontPage.id })
    .from(storefrontPage)
    .where(and(eq(storefrontPage.storefrontId, storefrontId), eq(storefrontPage.slug, parsed.data.slug)))
    .limit(1);
  if (existing) return { success: false, error: 'A page with this slug already exists' };

  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(${storefrontPage.sortOrder}), -1)` })
    .from(storefrontPage)
    .where(eq(storefrontPage.storefrontId, storefrontId));

  const pageId = createId();
  await db.insert(storefrontPage).values({
    id: pageId, storefrontId, slug: parsed.data.slug, title: parsed.data.title,
    puckData: EMPTY_PUCK_DATA, sortOrder: (maxSort?.max ?? -1) + 1,
  });

  revalidatePath('/my/selling/store/editor');
  return { success: true, pageId };
}

// ─── ACTION 2: savePuckData ─────────────────────────────────────────────

export async function savePuckData(
  data: { pageId: string; puckData: unknown }
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = savePuckDataSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };

  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return { success: false, error: 'No storefront found' };
  if (!await verifyPageOwnership(parsed.data.pageId, storefrontId))
    return { success: false, error: 'Page not found' };

  await db.update(storefrontPage)
    .set({ puckData: parsed.data.puckData, updatedAt: new Date() })
    .where(eq(storefrontPage.id, parsed.data.pageId));
  revalidatePath('/my/selling/store/editor');
  return { success: true };
}

// ─── ACTION 3: publishPage ──────────────────────────────────────────────

export async function publishPage(pageId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };
  if (!canUseFeature(profile.storeTier, 'puckEditor'))
    return { success: false, error: 'Page builder requires Power plan or higher' };
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return { success: false, error: 'No storefront found' };
  if (!await verifyPageOwnership(pageId, storefrontId))
    return { success: false, error: 'Page not found' };

  await db.update(storefrontPage).set({ isPublished: true, updatedAt: new Date() })
    .where(eq(storefrontPage.id, pageId));
  revalidatePath('/my/selling/store/editor');
  if (profile.storeSlug) revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}

// ─── ACTION 4: unpublishPage ────────────────────────────────────────────

export async function unpublishPage(pageId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return { success: false, error: 'No storefront found' };
  if (!await verifyPageOwnership(pageId, storefrontId))
    return { success: false, error: 'Page not found' };

  await db.update(storefrontPage).set({ isPublished: false, updatedAt: new Date() })
    .where(eq(storefrontPage.id, pageId));
  revalidatePath('/my/selling/store/editor');
  if (profile.storeSlug) revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}

// ─── ACTION 5: deletePage ───────────────────────────────────────────────

export async function deletePage(pageId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return { success: false, error: 'No storefront found' };
  if (!await verifyPageOwnership(pageId, storefrontId))
    return { success: false, error: 'Page not found' };

  await db.delete(storefrontPage).where(
    and(eq(storefrontPage.id, pageId), eq(storefrontPage.storefrontId, storefrontId))
  );
  revalidatePath('/my/selling/store/editor');
  if (profile.storeSlug) revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}

// ─── ACTION 6: reorderPages ────────────────────────────────────────────

export async function reorderPages(
  data: { pageIds: string[] }
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const profile = await getSellerProfileForUser(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (profile.sellerType !== 'BUSINESS')
    return { success: false, error: 'Business seller status required' };
  if (!canUseFeature(profile.storeTier, 'puckEditor'))
    return { success: false, error: 'Page builder requires Power plan or higher' };
  const parsed = reorderPagesSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const storefrontId = await getStorefrontIdForOwner(userId);
  if (!storefrontId) return { success: false, error: 'No storefront found' };

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.pageIds.length; i++) {
      const pid = parsed.data.pageIds[i];
      if (!pid) continue;
      await tx.update(storefrontPage).set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(storefrontPage.id, pid), eq(storefrontPage.storefrontId, storefrontId)));
    }
  });

  revalidatePath('/my/selling/store/editor');
  if (profile.storeSlug) revalidatePath(`/st/${profile.storeSlug}`);
  return { success: true };
}
