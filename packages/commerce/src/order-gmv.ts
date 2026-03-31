import { db } from '@twicely/db';
import { order, orderItem } from '@twicely/db/schema';
import { eq, and, inArray, sql, gte } from 'drizzle-orm';
import type { FeeBucket } from '@twicely/db/types';
import type { ShippingAddressJson } from './address-types';

export interface CreateOrderInput {
  userId: string;
  cartId: string;
  shippingAddress: ShippingAddressJson;
  buyerNote?: string;
  /** If true, this is a local pickup order (no shipping, progressive TF brackets per Decision #118) */
  isLocalPickup?: boolean;
  /** If true, buyer opted into authentication ($19.99 fee added to total) */
  authenticationRequested?: boolean;
}

export interface OrderCreationResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  totalCents?: number;
  shippingSavingsCents?: number;
  error?: string;
}

export interface CartItemWithDetails {
  cartItemId: string;
  listingId: string;
  quantity: number;
  priceCents: number;
  shippingCents: number;
  sellerId: string;
  title: string;
  categoryId: string | null;
  feeBucket: FeeBucket;
}

/**
 * Get start of current calendar month (for GMV calculation).
 */
export function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get seller's GMV for current calendar month.
 * Sum of (unitPriceCents * quantity) from order_item for completed orders.
 */
export async function getSellerMonthlyGmv(sellerId: string): Promise<number> {
  const monthStart = getMonthStart();

  const result = await db
    .select({
      totalGmv: sql<number>`COALESCE(SUM(${orderItem.unitPriceCents} * ${orderItem.quantity}), 0)::int`,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, sellerId),
        gte(order.createdAt, monthStart),
        // Count GMV from orders that are at least PAID (not cancelled)
        inArray(order.status, ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
      )
    );

  return result[0]?.totalGmv ?? 0;
}
