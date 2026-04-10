import { db } from '@twicely/db';
import { listingChild, variantReservation } from '@twicely/db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { ReserveStockResult } from './types';

export async function reserveStock(args: {
  listingChildId: string;
  userId: string;
  quantity: number;
  cartId?: string;
}): Promise<ReserveStockResult> {
  const reservationMinutes = await getPlatformSetting<number>(
    'catalog.variations.reservationMinutes', 30
  );

  // Transaction: SELECT FOR UPDATE -> check -> INSERT -> UPDATE
  return db.transaction(async (tx) => {
    // Lock the child row
    const [child] = await tx.select()
      .from(listingChild)
      .where(eq(listingChild.id, args.listingChildId))
      .for('update');

    if (!child) {
      return { success: false, error: 'Variant not found' };
    }

    if (child.availableQuantity < args.quantity) {
      return { success: false, error: 'Insufficient stock' };
    }

    const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);

    const [reservation] = await tx.insert(variantReservation).values({
      listingChildId: args.listingChildId,
      userId: args.userId,
      cartId: args.cartId ?? null,
      quantity: args.quantity,
      expiresAt,
      status: 'ACTIVE',
    }).returning();

    // Decrement available, increment reserved
    await tx.update(listingChild)
      .set({
        availableQuantity: child.availableQuantity - args.quantity,
        reservedQuantity: child.reservedQuantity + args.quantity,
        updatedAt: new Date(),
      })
      .where(eq(listingChild.id, args.listingChildId));

    return { success: true, reservationId: reservation.id };
  });
}

export async function releaseReservation(reservationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [reservation] = await tx.select()
      .from(variantReservation)
      .where(and(
        eq(variantReservation.id, reservationId),
        eq(variantReservation.status, 'ACTIVE'),
      ))
      .for('update');

    if (!reservation) return;

    await tx.update(variantReservation)
      .set({ status: 'RELEASED' })
      .where(eq(variantReservation.id, reservationId));

    // Restore available quantity
    await tx.update(listingChild)
      .set({
        availableQuantity: sql`${listingChild.availableQuantity} + ${reservation.quantity}`,
        reservedQuantity: sql`${listingChild.reservedQuantity} - ${reservation.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(listingChild.id, reservation.listingChildId));
  });
}

export async function convertReservation(reservationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [reservation] = await tx.select()
      .from(variantReservation)
      .where(and(
        eq(variantReservation.id, reservationId),
        eq(variantReservation.status, 'ACTIVE'),
      ))
      .for('update');

    if (!reservation) return;

    await tx.update(variantReservation)
      .set({ status: 'CONVERTED' })
      .where(eq(variantReservation.id, reservationId));

    // Decrement quantity (committed sale), decrement reserved
    await tx.update(listingChild)
      .set({
        quantity: sql`${listingChild.quantity} - ${reservation.quantity}`,
        reservedQuantity: sql`${listingChild.reservedQuantity} - ${reservation.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(listingChild.id, reservation.listingChildId));
  });
}

export async function expireStaleReservations(): Promise<{ released: number }> {
  const now = new Date();
  const expired = await db.select()
    .from(variantReservation)
    .where(and(
      eq(variantReservation.status, 'ACTIVE'),
      lt(variantReservation.expiresAt, now),
    ));

  let released = 0;
  for (const r of expired) {
    await releaseReservation(r.id);
    released++;
  }
  return { released };
}

export async function getAvailableQuantity(variantId: string): Promise<number> {
  const [child] = await db.select({
    availableQuantity: listingChild.availableQuantity,
  }).from(listingChild)
    .where(eq(listingChild.id, variantId))
    .limit(1);
  return child?.availableQuantity ?? 0;
}
