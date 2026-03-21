'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { kbArticle } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  createKbArticleSchema,
  updateKbArticleSchema,
} from '@/lib/validations/helpdesk';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── KB Articles ──────────────────────────────────────────────────────────────

export async function createKbArticle(
  formData: unknown
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return { success: false, error: 'Access denied. HELPDESK_LEAD role required.' };
  }

  const parsed = createKbArticleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const d = parsed.data;

  const articleRows = await db.insert(kbArticle).values({
    categoryId: d.categoryId,
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt ?? null,
    body: d.body,
    bodyFormat: d.bodyFormat,
    status: 'DRAFT',
    audience: d.audience,
    authorStaffId: session.staffUserId,
    tags: d.tags ?? [],
    searchKeywords: d.searchKeywords ?? [],
    metaTitle: d.metaTitle ?? null,
    metaDescription: d.metaDescription ?? null,
    isFeatured: d.isFeatured,
    isPinned: d.isPinned,
  }).returning({ id: kbArticle.id, slug: kbArticle.slug });

  const articleRow = articleRows[0];
  if (!articleRow) return { success: false, error: 'Insert failed' };
  revalidatePath('/kb');
  return { success: true, data: { id: articleRow.id, slug: articleRow.slug } };
}

export async function updateKbArticle(
  formData: unknown
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return { success: false, error: 'Access denied. HELPDESK_LEAD role required.' };
  }

  const parsed = updateKbArticleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { articleId, ...fields } = parsed.data;

  const existing = await db
    .select({ id: kbArticle.id })
    .from(kbArticle)
    .where(eq(kbArticle.id, articleId))
    .limit(1);
  if (!existing[0]) return { success: false, error: 'Not found' };

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.categoryId !== undefined) updateFields.categoryId = fields.categoryId;
  if (fields.slug !== undefined) updateFields.slug = fields.slug;
  if (fields.title !== undefined) updateFields.title = fields.title;
  if (fields.excerpt !== undefined) updateFields.excerpt = fields.excerpt;
  if (fields.body !== undefined) updateFields.body = fields.body;
  if (fields.bodyFormat !== undefined) updateFields.bodyFormat = fields.bodyFormat;
  if (fields.audience !== undefined) updateFields.audience = fields.audience;
  if (fields.tags !== undefined) updateFields.tags = fields.tags;
  if (fields.searchKeywords !== undefined) updateFields.searchKeywords = fields.searchKeywords;
  if (fields.metaTitle !== undefined) updateFields.metaTitle = fields.metaTitle;
  if (fields.metaDescription !== undefined) updateFields.metaDescription = fields.metaDescription;
  if (fields.isFeatured !== undefined) updateFields.isFeatured = fields.isFeatured;
  if (fields.isPinned !== undefined) updateFields.isPinned = fields.isPinned;

  await db.update(kbArticle)
    .set(updateFields)
    .where(eq(kbArticle.id, articleId));

  revalidatePath('/kb');
  revalidatePath('/h');
  return { success: true };
}

export async function publishKbArticle(articleId: string): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return { success: false, error: 'Access denied' };
  }

  // Publish requires HELPDESK_MANAGER or ADMIN (per canonical section 21.3)
  const canPublish =
    session.platformRoles.includes('HELPDESK_MANAGER') ||
    session.platformRoles.includes('ADMIN') ||
    session.platformRoles.includes('SUPER_ADMIN');
  if (!canPublish) {
    return { success: false, error: 'Access denied. HELPDESK_MANAGER role required to publish.' };
  }

  const existing = await db
    .select({ id: kbArticle.id, version: kbArticle.version })
    .from(kbArticle)
    .where(eq(kbArticle.id, articleId))
    .limit(1);
  const existingArticle = existing[0];
  if (!existingArticle) return { success: false, error: 'Not found' };

  const now = new Date();
  await db.update(kbArticle)
    .set({
      status: 'PUBLISHED',
      publishedAt: now,
      version: existingArticle.version + 1,
      updatedAt: now,
    })
    .where(eq(kbArticle.id, articleId));

  revalidatePath('/kb');
  revalidatePath('/h');
  return { success: true };
}

export async function archiveKbArticle(articleId: string): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return { success: false, error: 'Access denied' };
  }

  await db.update(kbArticle)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(eq(kbArticle.id, articleId));

  revalidatePath('/kb');
  revalidatePath('/h');
  return { success: true };
}

export async function submitForReview(articleId: string): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return { success: false, error: 'Access denied' };
  }

  await db.update(kbArticle)
    .set({ status: 'REVIEW', updatedAt: new Date() })
    .where(eq(kbArticle.id, articleId));

  revalidatePath('/kb');
  return { success: true };
}
