import { db } from '@twicely/db';
import { categoryAlert, category } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { CategoryAlertFilters } from '@/lib/actions/category-alerts';

export interface CategoryAlert {
  id: string;
  categoryId: string;
  categorySlug: string;
  filters: CategoryAlertFilters;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Get all category alerts for a user.
 */
export async function getCategoryAlerts(userId: string): Promise<CategoryAlert[]> {
  const rows = await db
    .select({
      id: categoryAlert.id,
      categoryId: categoryAlert.categoryId,
      categorySlug: category.slug,
      filtersJson: categoryAlert.filtersJson,
      isActive: categoryAlert.isActive,
      createdAt: categoryAlert.createdAt,
    })
    .from(categoryAlert)
    .innerJoin(category, eq(category.id, categoryAlert.categoryId))
    .where(eq(categoryAlert.userId, userId))
    .orderBy(desc(categoryAlert.createdAt));

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    categorySlug: row.categorySlug,
    filters: row.filtersJson as CategoryAlertFilters,
    isActive: row.isActive,
    createdAt: row.createdAt,
  }));
}

/**
 * Get all active alerts matching a specific categoryId (for notifications).
 */
export async function getAlertsForCategory(categoryId: string): Promise<Array<{ userId: string; alertId: string }>> {
  const rows = await db
    .select({
      id: categoryAlert.id,
      userId: categoryAlert.userId,
    })
    .from(categoryAlert)
    .where(
      and(
        eq(categoryAlert.categoryId, categoryId),
        eq(categoryAlert.isActive, true)
      )
    );

  return rows.map((row) => ({
    userId: row.userId,
    alertId: row.id,
  }));
}
