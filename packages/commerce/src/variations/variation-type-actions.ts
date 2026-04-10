import { db } from '@twicely/db';
import { variationType } from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { CreateVariationTypeInput, UpdateVariationTypeInput, VariationType } from './types';

export async function createVariationType(input: CreateVariationTypeInput): Promise<VariationType> {
  const [row] = await db.insert(variationType).values({
    key: input.key,
    label: input.label,
    description: input.description,
    icon: input.icon,
  }).returning();
  return row;
}

export async function updateVariationType(
  id: string,
  input: UpdateVariationTypeInput
): Promise<VariationType> {
  const [row] = await db.update(variationType)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(variationType.id, id))
    .returning();
  if (!row) throw new Error('Variation type not found');
  return row;
}

export async function deactivateVariationType(id: string): Promise<void> {
  const [existing] = await db.select()
    .from(variationType)
    .where(eq(variationType.id, id))
    .limit(1);
  if (!existing) throw new Error('Variation type not found');
  if (existing.isSystem) throw new Error('System variation types cannot be deactivated');
  if (existing.totalListings > 0) {
    throw new Error('Cannot deactivate variation type with active listings');
  }
  await db.update(variationType)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(variationType.id, id));
}

export async function getVariationTypes(opts?: {
  activeOnly?: boolean;
}): Promise<VariationType[]> {
  const query = db.select().from(variationType);
  if (opts?.activeOnly) {
    return query.where(eq(variationType.isActive, true)).orderBy(asc(variationType.sortOrder));
  }
  return query.orderBy(asc(variationType.sortOrder));
}
