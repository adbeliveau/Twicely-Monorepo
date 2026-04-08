import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { order, orderItem, listing, sequenceCounter } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';
import { LISTING_IDS } from './seed-listings';
import { generateOrderNumber } from '@twicely/commerce/order-number';

// Order IDs (10 total)
const ORDER_IDS = [
  'seed-order-001',
  'seed-order-002',
  'seed-order-003',
  'seed-order-004',
  'seed-order-005',
  'seed-order-006',
  'seed-order-007',
  'seed-order-008',
  'seed-order-009',
  'seed-order-010',
];

// Order Item IDs
const ORDER_ITEM_IDS = [
  'seed-oi-001',
  'seed-oi-002',
  'seed-oi-003',
  'seed-oi-004',
  'seed-oi-005',
  'seed-oi-006',
  'seed-oi-007',
  'seed-oi-008',
  'seed-oi-009',
  'seed-oi-010',
];

// Buyer addresses as JSON for orders
const BUYER_ADDRESSES: Record<string, string> = {
  buyer1: JSON.stringify({
    name: 'Emma Thompson',
    address1: '123 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'US',
  }),
  buyer2: JSON.stringify({
    name: 'James Wilson',
    address1: '456 Oak Ave',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    country: 'US',
  }),
  buyer3: JSON.stringify({
    name: 'Sofia Garcia',
    address1: '789 Pine Blvd',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    country: 'US',
  }),
};

// Price data for listings used in orders (in cents) - indexed by priceIdx
const LISTING_PRICES: number[] = [
  89900,   // 0 - iPhone 14 Pro Max
  79900,   // 1 - Samsung Galaxy S23
  44900,   // 2 - iPad Air 5th Gen
  6800,    // 3 - Lululemon Align (listing 20)
  8500,    // 4 - Free People Maxi (listing 21)
  9500,    // 5 - Reformation Silk (listing 22)
  45000,   // 6 - Pokemon Charizard (listing 35)
  250000,  // 7 - MTG Black Lotus (listing 36)
  18500,   // 8 - Yu-Gi-Oh Blue Eyes (listing 37)
  1150000, // 9 - Rolex Submariner (listing 38)
];

// Listing titles for snapshots - indexed by priceIdx
const LISTING_TITLES: string[] = [
  'iPhone 14 Pro Max 256GB Space Black',
  'Samsung Galaxy S23 Ultra 512GB',
  'iPad Air 5th Gen 64GB WiFi',
  'Lululemon Align High-Rise Leggings 25"',
  'Free People Maxi Dress Floral Print',
  'Reformation Silk Midi Skirt Navy',
  'Pokemon Base Set Charizard Holo PSA 8',
  'Magic The Gathering Black Lotus HP',
  'Yu-Gi-Oh Blue Eyes White Dragon 1st Ed',
  'Rolex Submariner Date 116610LN',
];

// Listing conditions - indexed by priceIdx
const LISTING_CONDITIONS: string[] = [
  'LIKE_NEW', 'VERY_GOOD', 'LIKE_NEW',
  'LIKE_NEW', 'VERY_GOOD', 'LIKE_NEW',
  'VERY_GOOD', 'GOOD', 'VERY_GOOD', 'LIKE_NEW',
];

// Mapping from priceIdx to actual listing index in LISTING_IDS
const PRICE_TO_LISTING_IDX: number[] = [0, 1, 2, 20, 21, 22, 35, 36, 37, 38];

export async function seedOrders(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  // Shipping costs (deterministic per order)
  const shippingCosts: number[] = [800, 950, 700, 850, 1100, 1200, 750, 650, 900, 500];

  type OrderInsert = typeof order.$inferInsert;
  type OrderItemInsert = typeof orderItem.$inferInsert;

  // Build order values directly
  const orderValues: OrderInsert[] = [
    // Order 1: PAID - buyer1 from seller1
    {
      id: ORDER_IDS[0], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller1,
      status: 'PAID', itemSubtotalCents: LISTING_PRICES[0]!, shippingCents: shippingCosts[0]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[0]! + shippingCosts[0]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer1, handlingDueDays: 3,
      isLateShipment: false, paidAt: twoDaysAgo, expectedShipByAt: now,
    },
    // Order 2: PAID LATE - buyer2 from seller1
    {
      id: ORDER_IDS[1], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller1,
      status: 'PAID', itemSubtotalCents: LISTING_PRICES[1]!, shippingCents: shippingCosts[1]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[1]! + shippingCosts[1]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer2, handlingDueDays: 3,
      isLateShipment: true, paidAt: fiveDaysAgo, expectedShipByAt: twoDaysAgo,
    },
    // Order 3: PROCESSING - buyer1 from seller2
    {
      id: ORDER_IDS[2], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller2,
      status: 'PROCESSING', itemSubtotalCents: LISTING_PRICES[3]!, shippingCents: shippingCosts[2]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[3]! + shippingCosts[2]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer1, handlingDueDays: 3,
      isLateShipment: false, paidAt: twoDaysAgo,
    },
    // Order 4: SHIPPED - buyer3 from seller2
    {
      id: ORDER_IDS[3], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer3, sellerId: USER_IDS.seller2,
      status: 'SHIPPED', itemSubtotalCents: LISTING_PRICES[4]!, shippingCents: shippingCosts[3]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[4]! + shippingCosts[3]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer3, handlingDueDays: 3,
      isLateShipment: false, paidAt: fiveDaysAgo, shippedAt: twoDaysAgo,
      trackingNumber: '9400111899223033005282',
    },
    // Order 5: IN_TRANSIT - buyer2 from seller3
    {
      id: ORDER_IDS[4], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller3,
      status: 'IN_TRANSIT', itemSubtotalCents: LISTING_PRICES[6]!, shippingCents: shippingCosts[4]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[6]! + shippingCosts[4]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer2, handlingDueDays: 3,
      isLateShipment: false, paidAt: tenDaysAgo, shippedAt: fiveDaysAgo,
      trackingNumber: '9400111899223033005282',
      trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223033005282',
    },
    // Order 6: DELIVERED - buyer1 from seller3
    {
      id: ORDER_IDS[5], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller3,
      status: 'DELIVERED', itemSubtotalCents: LISTING_PRICES[7]!, shippingCents: shippingCosts[5]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[7]! + shippingCosts[5]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer1, handlingDueDays: 3,
      isLateShipment: false, paidAt: fifteenDaysAgo, shippedAt: tenDaysAgo, deliveredAt: fiveDaysAgo,
    },
    // Order 7: COMPLETED - buyer3 from seller1
    {
      id: ORDER_IDS[6], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer3, sellerId: USER_IDS.seller1,
      status: 'COMPLETED', itemSubtotalCents: LISTING_PRICES[2]!, shippingCents: shippingCosts[6]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[2]! + shippingCosts[6]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer3, handlingDueDays: 3,
      isLateShipment: false, paidAt: fifteenDaysAgo, shippedAt: tenDaysAgo, deliveredAt: fiveDaysAgo, completedAt: twoDaysAgo,
    },
    // Order 8: COMPLETED - buyer2 from seller2
    {
      id: ORDER_IDS[7], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer2, sellerId: USER_IDS.seller2,
      status: 'COMPLETED', itemSubtotalCents: LISTING_PRICES[5]!, shippingCents: shippingCosts[7]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[5]! + shippingCosts[7]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer2, handlingDueDays: 3,
      isLateShipment: false, paidAt: fifteenDaysAgo, shippedAt: tenDaysAgo, deliveredAt: fiveDaysAgo, completedAt: twoDaysAgo,
    },
    // Order 9: CANCELED - buyer1 from seller3
    {
      id: ORDER_IDS[8], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer1, sellerId: USER_IDS.seller3,
      status: 'CANCELED', itemSubtotalCents: LISTING_PRICES[8]!, shippingCents: shippingCosts[8]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[8]! + shippingCosts[8]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer1, handlingDueDays: 3,
      isLateShipment: false, cancelInitiator: 'BUYER', cancelReason: 'Changed my mind', canceledAt: twoDaysAgo,
    },
    // Order 10: DISPUTED - buyer3 from seller3 (return in progress)
    {
      id: ORDER_IDS[9], orderNumber: generateOrderNumber(), buyerId: USER_IDS.buyer3, sellerId: USER_IDS.seller3,
      status: 'DISPUTED', itemSubtotalCents: LISTING_PRICES[9]!, shippingCents: shippingCosts[9]!,
      taxCents: 0, discountCents: 0, totalCents: LISTING_PRICES[9]! + shippingCosts[9]!,
      currency: 'USD', shippingAddressJson: BUYER_ADDRESSES.buyer3, handlingDueDays: 3,
      isLateShipment: false, paidAt: fifteenDaysAgo, shippedAt: tenDaysAgo, deliveredAt: fiveDaysAgo,
    },
  ];

  await db.insert(order).values(orderValues).onConflictDoNothing();

  // Order to priceIdx mapping for order items
  const orderPriceIdx = [0, 1, 3, 4, 6, 7, 2, 5, 8, 9];

  // Build order item values
  const orderItemValues: OrderItemInsert[] = orderPriceIdx.map((priceIdx, orderIdx) => ({
    id: ORDER_ITEM_IDS[orderIdx],
    orderId: ORDER_IDS[orderIdx]!,
    listingId: LISTING_IDS[PRICE_TO_LISTING_IDX[priceIdx]!]!,
    listingSnapshotJson: JSON.stringify({
      title: LISTING_TITLES[priceIdx],
      priceCents: LISTING_PRICES[priceIdx],
      condition: LISTING_CONDITIONS[priceIdx],
    }),
    title: LISTING_TITLES[priceIdx]!,
    quantity: 1,
    unitPriceCents: LISTING_PRICES[priceIdx]!,
    currency: 'USD',
  }));

  await db.insert(orderItem).values(orderItemValues).onConflictDoNothing();

  // Update listings to SOLD for orders that sold (all except order 9 which was CANCELED)
  // Map: [orderIdx, priceIdx, soldAt]
  const soldOrders: [number, number, Date][] = [
    [0, 0, twoDaysAgo],        // Order 1
    [1, 1, fiveDaysAgo],       // Order 2
    [2, 3, twoDaysAgo],        // Order 3
    [3, 4, fiveDaysAgo],       // Order 4
    [4, 6, tenDaysAgo],        // Order 5
    [5, 7, fifteenDaysAgo],    // Order 6
    [6, 2, fifteenDaysAgo],    // Order 7
    [7, 5, fifteenDaysAgo],    // Order 8
    // Order 9 is CANCELED - not sold
    [9, 9, fifteenDaysAgo],    // Order 10
  ];

  for (const [, priceIdx, soldAt] of soldOrders) {
    const listingIdx = PRICE_TO_LISTING_IDX[priceIdx]!;
    const listingId = LISTING_IDS[listingIdx]!;

    await db
      .update(listing)
      .set({
        status: 'SOLD',
        soldQuantity: 1,
        availableQuantity: 0,
        soldAt,
        updatedAt: soldAt,
      })
      .where(eq(listing.id, listingId));
  }

  // Update sequence counter to reflect 10 orders created
  await db
    .update(sequenceCounter)
    .set({ currentValue: 10, updatedAt: now })
    .where(eq(sequenceCounter.name, 'order_number'));
}
