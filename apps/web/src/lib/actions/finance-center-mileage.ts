'use server';

import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { mileageEntry } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createMileageSchema,
  updateMileageSchema,
  deleteMileageSchema,
  listMileageSchema,
} from '@/lib/validations/finance-center';
import { getFinanceTier } from '@/lib/queries/finance-center';
import {
  getMileageList,
  getMileageById,
  type MileageRow,
  type MileageListResult,
} from '@/lib/queries/finance-center-mileage';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export type CreateMileageResponse =
  | { success: true; entry: MileageRow }
  | { success: false; error: string };

export type UpdateMileageResponse =
  | { success: true; entry: MileageRow }
  | { success: false; error: string };

export type DeleteMileageResponse =
  | { success: true }
  | { success: false; error: string };

export type ListMileageResponse =
  | { success: true; data: MileageListResult }
  | { success: false; error: string };

const MILEAGE_RETURNING = {
  id: mileageEntry.id,
  description: mileageEntry.description,
  miles: mileageEntry.miles,
  ratePerMile: mileageEntry.ratePerMile,
  deductionCents: mileageEntry.deductionCents,
  tripDate: mileageEntry.tripDate,
  createdAt: mileageEntry.createdAt,
} as const;

function resolveUserId(
  session: { delegationId: string | null; onBehalfOfSellerId?: string | null; userId: string },
): string {
  return session.delegationId ? session.onBehalfOfSellerId! : session.userId;
}

export async function createMileageAction(
  input: unknown,
): Promise<CreateMileageResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('create', sub('MileageEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createMileageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to track mileage' };
  }

  try {
    const irsRate = await getPlatformSetting<number>('finance.mileageRatePerMile', 0.70);
    const deductionCents = Math.round(parsed.data.miles * irsRate * 100);

    const [inserted] = await db
      .insert(mileageEntry)
      .values({
        userId,
        description: parsed.data.description,
        miles: parsed.data.miles,
        ratePerMile: irsRate,
        deductionCents,
        tripDate: new Date(parsed.data.tripDate),
      })
      .returning(MILEAGE_RETURNING);

    if (!inserted) return { success: false, error: 'Failed to create mileage entry' };

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/mileage');
    return { success: true, entry: inserted };
  } catch (error) {
    logger.error('[createMileageAction] Failed to create mileage entry', { error: String(error) });
    return { success: false, error: 'Failed to create mileage entry' };
  }
}

export async function updateMileageAction(
  input: unknown,
): Promise<UpdateMileageResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('update', sub('MileageEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateMileageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to track mileage' };
  }

  try {
    const { id, ...fields } = parsed.data;

    const existing = await getMileageById(userId, id);
    if (!existing) return { success: false, error: 'Mileage entry not found' };

    const updateValues: Partial<{
      description: string;
      miles: number;
      deductionCents: number;
      tripDate: Date;
    }> = {};

    if (fields.description !== undefined) updateValues.description = fields.description;
    if (fields.tripDate !== undefined) updateValues.tripDate = new Date(fields.tripDate);

    // Recalculate deduction using STORED rate when miles change
    if (fields.miles !== undefined) {
      updateValues.miles = fields.miles;
      updateValues.deductionCents = Math.round(fields.miles * existing.ratePerMile * 100);
    }

    const [updated] = await db
      .update(mileageEntry)
      .set(updateValues)
      .where(and(eq(mileageEntry.id, id), eq(mileageEntry.userId, userId)))
      .returning(MILEAGE_RETURNING);

    if (!updated) return { success: false, error: 'Failed to update mileage entry' };

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/mileage');
    return { success: true, entry: updated };
  } catch (error) {
    logger.error('[updateMileageAction] Failed to update mileage entry', { error: String(error) });
    return { success: false, error: 'Failed to update mileage entry' };
  }
}

export async function deleteMileageAction(
  input: unknown,
): Promise<DeleteMileageResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('delete', sub('MileageEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = deleteMileageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to track mileage' };
  }

  try {
    const { id } = parsed.data;

    const existing = await getMileageById(userId, id);
    if (!existing) return { success: false, error: 'Mileage entry not found' };

    await db
      .delete(mileageEntry)
      .where(and(eq(mileageEntry.id, id), eq(mileageEntry.userId, userId)));

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/mileage');
    return { success: true };
  } catch (error) {
    logger.error('[deleteMileageAction] Failed to delete mileage entry', { error: String(error) });
    return { success: false, error: 'Failed to delete mileage entry' };
  }
}

export async function listMileageAction(
  input: unknown,
): Promise<ListMileageResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('MileageEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = listMileageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to view mileage' };
  }

  try {
    const data = await getMileageList(userId, parsed.data);
    return { success: true, data };
  } catch (error) {
    logger.error('[listMileageAction] Failed to load mileage entries', { error: String(error) });
    return { success: false, error: 'Failed to load mileage entries' };
  }
}
