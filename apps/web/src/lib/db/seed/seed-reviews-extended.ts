import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { buyerReview } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';

// Order IDs from seed-orders.ts (referencing completed/delivered orders)
const ORDER_IDS = {
  order7: 'seed-order-007',  // COMPLETED: buyer3 from seller1
  order8: 'seed-order-008',  // COMPLETED: buyer2 from seller2
  order6: 'seed-order-006',  // DELIVERED: buyer1 from seller3
};

// Hardcoded IDs for idempotency
const BUYER_REVIEW_IDS = {
  br1: 'seed-br-001',
  br2: 'seed-br-002',
  br3: 'seed-br-003',
};

export async function seedBuyerReviews(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Buyer Reviews (seller rates buyer after completed orders)
  // 3 reviews: one 5-star, one 4-star, one 2-star with note
  // visibleAt set to past date (dual-blind window closed)
  await db.insert(buyerReview).values([
    // seller1 reviews buyer3 (Order 7) - 5 stars
    {
      id: BUYER_REVIEW_IDS.br1,
      orderId: ORDER_IDS.order7,
      sellerUserId: USER_IDS.seller1,
      buyerUserId: USER_IDS.buyer3,
      ratingPayment: 5,
      ratingCommunication: 5,
      ratingReturnBehavior: null, // No return occurred
      overallRating: 5,
      note: null,
      status: 'APPROVED',
      visibleAt: daysAgo(1), // Dual-blind window closed
      createdAt: daysAgo(2),
    },
    // seller2 reviews buyer2 (Order 8) - 4 stars
    {
      id: BUYER_REVIEW_IDS.br2,
      orderId: ORDER_IDS.order8,
      sellerUserId: USER_IDS.seller2,
      buyerUserId: USER_IDS.buyer2,
      ratingPayment: 5,
      ratingCommunication: 4,
      ratingReturnBehavior: null, // No return occurred
      overallRating: 4,
      note: null,
      status: 'APPROVED',
      visibleAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    // seller3 reviews buyer1 (Order 6) - 2 stars with note
    {
      id: BUYER_REVIEW_IDS.br3,
      orderId: ORDER_IDS.order6,
      sellerUserId: USER_IDS.seller3,
      buyerUserId: USER_IDS.buyer1,
      ratingPayment: 3,
      ratingCommunication: 2,
      ratingReturnBehavior: null, // No return occurred
      overallRating: 2,
      note: 'Multiple messages asking for discounts after purchase. Delayed payment initially.',
      status: 'APPROVED',
      visibleAt: daysAgo(3),
      createdAt: daysAgo(5),
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const BUYER_REVIEW_SEED_IDS = BUYER_REVIEW_IDS;
