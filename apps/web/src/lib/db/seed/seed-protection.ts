import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { buyerProtectionClaim } from '../schema';
import { USER_IDS } from './seed-users';
import { SEED_IDS } from './seed-system';

// Hardcoded IDs for idempotency
const CLAIM_IDS = {
  openClaim:     'seed-bpc-001',
  resolvedClaim: 'seed-bpc-002',
};

// Order IDs referenced (must match seed-orders.ts)
const ORDER_IDS = {
  order6:  'seed-order-006',
  order10: 'seed-order-010',
};

// Order 6: buyer1 from seller3, MTG Black Lotus, total = 250000 + 1200 = 251200 cents
// Order 10: buyer3 from seller3, Rolex Submariner, total = 1150000 + 500 = 1150500 cents

/**
 * Seed buyer protection claims.
 * Depends on seedOrders(), seedUsers(), seedSystem() running first.
 */
export async function seedProtection(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  await db.insert(buyerProtectionClaim).values([
    {
      // OPEN claim: buyer3 vs seller3 on disputed order (order 10)
      id:                  CLAIM_IDS.openClaim,
      orderId:             ORDER_IDS.order10,
      buyerId:             USER_IDS.buyer3,
      sellerId:            USER_IDS.seller3,
      claimType:           'INAD',
      status:              'OPEN',
      claimAmountCents:    1150500,
      evidenceJson:        [
        {
          type: 'photo',
          url: 'https://placehold.co/800x600/eee/999?text=Evidence+Photo+1',
          description: 'Item does not match listing description',
        },
        {
          type: 'photo',
          url: 'https://placehold.co/800x600/eee/999?text=Evidence+Photo+2',
          description: 'Missing crown and bezel shows wear',
        },
      ],
      createdAt:           daysAgo(2),
      updatedAt:           daysAgo(2),
    },
    {
      // RESOLVED claim: buyer1 vs seller3 on delivered order (order 6)
      id:                  CLAIM_IDS.resolvedClaim,
      orderId:             ORDER_IDS.order6,
      buyerId:             USER_IDS.buyer1,
      sellerId:            USER_IDS.seller3,
      claimType:           'DAMAGED',
      status:              'RESOLVED',
      claimAmountCents:    251200,
      approvedAmountCents: 251200,
      evidenceJson:        [
        {
          type: 'photo',
          url: 'https://placehold.co/800x600/eee/999?text=Damaged+Packaging',
          description: 'Damaged packaging upon arrival',
        },
      ],
      resolutionNote:      'Claim approved. Full refund issued to buyer. Item deemed damaged in transit.',
      resolvedByStaffId:   SEED_IDS.staffAdminId,
      resolvedAt:          daysAgo(3),
      paidAt:              daysAgo(3),
      createdAt:           daysAgo(8),
      updatedAt:           daysAgo(3),
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const PROTECTION_IDS = CLAIM_IDS;
