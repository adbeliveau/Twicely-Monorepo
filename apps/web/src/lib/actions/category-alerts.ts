'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { categoryAlert } from '@twicely/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { saveCategoryAlertSchema, deleteCategoryAlertSchema } from '@/lib/validations/alerts';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface SaveAlertResult {
  success: boolean;
  alertId?: string;
  error?: string;
}

export interface CategoryAlertFilters {
  categoryId: string;
  categoryName: string;
  condition?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
}

/**
 * Save a category alert (category_alert table per schema §27.4).
 * Max per user enforced via discovery.priceAlert.categoryAlertMaxPerUser (default 20).
 */
export async function saveCategoryAlertAction(
  filters: CategoryAlertFilters
): Promise<SaveAlertResult> {
  const parsed = saveCategoryAlertSchema.safeParse(filters);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('create', 'Notification')) return { success: false, error: 'Not authorized' };

  try {
    // Check if user already has an alert for this category
    const [existing] = await db
      .select({ id: categoryAlert.id })
      .from(categoryAlert)
      .where(
        and(
          eq(categoryAlert.userId, session.userId),
          eq(categoryAlert.categoryId, filters.categoryId),
          eq(categoryAlert.isActive, true)
        )
      )
      .limit(1);

    if (existing) {
      return { success: false, error: 'Alert already exists for this category' };
    }

    // Enforce max alerts per user (Platform Settings canonical)
    const maxAlerts = await getPlatformSetting<number>(
      'discovery.priceAlert.categoryAlertMaxPerUser', 20
    );
    const [countResult] = await db
      .select({ count: count() })
      .from(categoryAlert)
      .where(eq(categoryAlert.userId, session.userId));

    if ((countResult?.count ?? 0) >= maxAlerts) {
      return { success: false, error: `Maximum of ${maxAlerts} alerts reached` };
    }

    const [alert] = await db
      .insert(categoryAlert)
      .values({
        userId: session.userId,
        categoryId: filters.categoryId,
        filtersJson: {
          categoryName: filters.categoryName,
          condition: filters.condition,
          minPriceCents: filters.minPriceCents,
          maxPriceCents: filters.maxPriceCents,
        },
        isActive: true,
      })
      .returning({ id: categoryAlert.id });

    revalidatePath('/my/buying/alerts');
    return { success: true, alertId: alert?.id };
  } catch (error) {
    logger.error('Save category alert error', { error: String(error) });
    return { success: false, error: 'Failed to save alert' };
  }
}

interface DeleteAlertResult {
  success: boolean;
  error?: string;
}

/**
 * Delete a category alert by ID (owner check).
 */
export async function deleteCategoryAlertAction(alertId: string): Promise<DeleteAlertResult> {
  const parsed = deleteCategoryAlertSchema.safeParse({ alertId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('delete', 'Notification')) return { success: false, error: 'Not authorized' };

  try {
    const [existing] = await db
      .select({ id: categoryAlert.id, userId: categoryAlert.userId })
      .from(categoryAlert)
      .where(eq(categoryAlert.id, alertId))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Alert not found' };
    }

    if (existing.userId !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.delete(categoryAlert).where(eq(categoryAlert.id, alertId));

    revalidatePath('/my/buying/alerts');
    return { success: true };
  } catch (error) {
    logger.error('Delete category alert error', { error: String(error) });
    return { success: false, error: 'Failed to delete alert' };
  }
}
