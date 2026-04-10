/**
 * Admin Search Actions — OpenSearch Operations (Decision #143)
 * Mutations for the /cfg/search/* admin surface.
 * All actions require staffAuthorize() + ability.can('manage', 'Setting').
 */

'use server';

import { db } from '@twicely/db';
import { searchSynonymSet, searchRule } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { logger } from '@twicely/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const synonymSchema = z.object({
  name: z.string().min(1).max(100),
  terms: z.array(z.string().min(1)).min(2),
  enabled: z.boolean().optional().default(true),
});

const ruleSchema = z.object({
  ruleType: z.enum(['PIN', 'BURY', 'REWRITE', 'REDIRECT', 'BLOCK']),
  queryPattern: z.string().min(1).max(200),
  payloadJson: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(1000).optional().default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

// ─── Reindex Actions ──────────────────────────────────────────────────────────

export async function triggerFullReindex() {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const { enqueueFullReindex } = await import('@twicely/jobs/search-full-reindex');
    await enqueueFullReindex(session.staffUserId);
    logger.info('[admin-search] Full reindex triggered', { staffId: session.staffUserId });
    revalidatePath('/cfg/search');
    return { success: true };
  } catch (err) {
    logger.error('[admin-search] Failed to trigger reindex', { error: String(err) });
    return { error: 'Failed to enqueue reindex job' };
  }
}

export async function triggerAliasSwap(indexName: string) {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const { swapReadAlias } = await import('@twicely/search/opensearch-lifecycle');
    await swapReadAlias(indexName);
    logger.info('[admin-search] Alias swapped', { indexName, staffId: session.staffUserId });
    revalidatePath('/cfg/search/indexes');
    return { success: true };
  } catch (err) {
    logger.error('[admin-search] Alias swap failed', { error: String(err) });
    return { error: 'Alias swap failed' };
  }
}

export async function triggerRollback(previousIndexName: string) {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const { rollbackAlias } = await import('@twicely/search/opensearch-lifecycle');
    await rollbackAlias(previousIndexName);
    logger.info('[admin-search] Rollback executed', { previousIndexName, staffId: session.staffUserId });
    revalidatePath('/cfg/search/indexes');
    return { success: true };
  } catch (err) {
    logger.error('[admin-search] Rollback failed', { error: String(err) });
    return { error: 'Rollback failed' };
  }
}

export async function deleteOldIndexes(keepCount = 2) {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const { deleteOldIndices } = await import('@twicely/search/opensearch-lifecycle');
    const deleted = await deleteOldIndices(keepCount);
    logger.info('[admin-search] Old indexes deleted', { deleted, staffId: session.staffUserId });
    revalidatePath('/cfg/search/indexes');
    return { success: true, deleted };
  } catch (err) {
    logger.error('[admin-search] Index cleanup failed', { error: String(err) });
    return { error: 'Index cleanup failed' };
  }
}

export async function refreshSearchIndex() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const { refreshIndex } = await import('@twicely/search/opensearch-admin');
    await refreshIndex();
    return { success: true };
  } catch (err) {
    logger.error('[admin-search] Refresh failed', { error: String(err) });
    return { error: 'Refresh failed' };
  }
}

// ─── Synonym Actions ──────────────────────────────────────────────────────────

export async function createSynonym(input: z.infer<typeof synonymSchema>) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  const parsed = synonymSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const id = createId();
  await db.insert(searchSynonymSet).values({
    id,
    name: parsed.data.name,
    terms: parsed.data.terms,
    enabled: parsed.data.enabled,
  });

  revalidatePath('/cfg/search/synonyms');
  return { success: true, id };
}

export async function updateSynonym(id: string, input: Partial<z.infer<typeof synonymSchema>>) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  await db
    .update(searchSynonymSet)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(searchSynonymSet.id, id));

  revalidatePath('/cfg/search/synonyms');
  return { success: true };
}

export async function deleteSynonym(id: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  await db.delete(searchSynonymSet).where(eq(searchSynonymSet.id, id));
  revalidatePath('/cfg/search/synonyms');
  return { success: true };
}

export async function applySynonymsToIndex() {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  try {
    const synonyms = await db
      .select()
      .from(searchSynonymSet)
      .where(eq(searchSynonymSet.enabled, true));

    const { applySynonyms } = await import('@twicely/search/opensearch-admin');
    const { getActiveIndex } = await import('@twicely/search/opensearch-lifecycle');
    const activeIndex = await getActiveIndex();

    if (!activeIndex) return { error: 'No active index' };

    await applySynonyms(activeIndex, synonyms.map((s) => ({ terms: s.terms })));
    logger.info('[admin-search] Synonyms applied', { count: synonyms.length, staffId: session.staffUserId });
    return { success: true, appliedCount: synonyms.length };
  } catch (err) {
    logger.error('[admin-search] Apply synonyms failed', { error: String(err) });
    return { error: 'Failed to apply synonyms' };
  }
}

// ─── Rule Actions ────────────────────────────────────────────────────────────

export async function createSearchRule(input: z.infer<typeof ruleSchema>) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const id = createId();
  await db.insert(searchRule).values({
    id,
    ruleType: parsed.data.ruleType,
    queryPattern: parsed.data.queryPattern,
    payloadJson: parsed.data.payloadJson,
    enabled: parsed.data.enabled,
    priority: parsed.data.priority,
    startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
  });

  revalidatePath('/cfg/search/rules');
  return { success: true, id };
}

export async function updateSearchRule(id: string, input: Partial<z.infer<typeof ruleSchema>>) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  await db
    .update(searchRule)
    .set({
      ...input,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(searchRule.id, id));

  revalidatePath('/cfg/search/rules');
  return { success: true };
}

export async function deleteSearchRule(id: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Access denied' };
  }

  await db.delete(searchRule).where(eq(searchRule.id, id));
  revalidatePath('/cfg/search/rules');
  return { success: true };
}
