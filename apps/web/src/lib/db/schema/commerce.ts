import { pgTable, text, integer, boolean, timestamp, jsonb, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { cartStatusEnum, orderStatusEnum, cancelInitiatorEnum, feeBucketEnum } from './enums';
import { user } from './auth';
import { listing } from './listings';

// §6.1 cart
export const cart = pgTable('cart', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').references(() => user.id),
  sessionId:        text('session_id'),
  status:           cartStatusEnum('status').notNull().default('ACTIVE'),
  itemCount:        integer('item_count').notNull().default(0),
  subtotalCents:    integer('subtotal_cents').notNull().default(0),
  currency:         text('currency').notNull().default('USD'),
  expiresAt:        timestamp('expires_at', { withTimezone: true }),
  lastActivityAt:   timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  reminderSentAt:   timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActiveIdx:    uniqueIndex('cart_user_active').on(table.userId, table.status),
  sessionIdx:       index('cart_session').on(table.sessionId, table.status),
  expiresIdx:       index('cart_expires').on(table.status, table.expiresAt),
}));

// §6.2 cartItem
export const cartItem = pgTable('cart_item', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  cartId:            text('cart_id').notNull().references(() => cart.id, { onDelete: 'cascade' }),
  listingId:         text('listing_id').notNull().references(() => listing.id),
  quantity:          integer('quantity').notNull().default(1),
  priceCents:        integer('price_cents').notNull(),
  currency:          text('currency').notNull().default('USD'),
  sellerId:          text('seller_id').notNull(),
  isAvailable:       boolean('is_available').notNull().default(true),
  unavailableReason: text('unavailable_reason'),
  isSavedForLater:   boolean('is_saved_for_later').notNull().default(false),
  addedAt:           timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cartListingIdx:    unique().on(table.cartId, table.listingId),
  listingIdx:        index('ci_listing').on(table.listingId),
  sellerIdx:         index('ci_seller').on(table.sellerId),
}));

// §6.3 order
export const order = pgTable('order', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber:           text('order_number').notNull().unique(),
  buyerId:               text('buyer_id').notNull().references(() => user.id),
  sellerId:              text('seller_id').notNull(),
  status:                orderStatusEnum('status').notNull().default('CREATED'),
  sourceCartId:          text('source_cart_id'),

  // Local pickup
  isLocalPickup:         boolean('is_local_pickup').notNull().default(false),
  localTransactionId:    text('local_transaction_id'),  // FK to localTransaction set after order created
  combinedShippingQuoteId: text('combined_shipping_quote_id'),  // FK to combinedShippingQuote

  // Authentication (B3.5)
  authenticationOffered:    boolean('authentication_offered').notNull().default(false),
  authenticationDeclined:   boolean('authentication_declined').notNull().default(false),
  authenticationDeclinedAt: timestamp('authentication_declined_at', { withTimezone: true }),
  authenticationRequestId:  text('authentication_request_id'),

  // Money
  itemSubtotalCents:     integer('item_subtotal_cents').notNull(),
  shippingCents:         integer('shipping_cents').notNull().default(0),
  taxCents:              integer('tax_cents').notNull().default(0),
  discountCents:         integer('discount_cents').notNull().default(0),
  totalCents:            integer('total_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),

  // Shipping
  shippingAddressJson:   jsonb('shipping_address_json').notNull().default(sql`'{}'`),
  shippingMethod:        text('shipping_method'),
  trackingNumber:        text('tracking_number'),
  trackingUrl:           text('tracking_url'),
  carrierCode:           text('carrier_code'),
  handlingDueDays:       integer('handling_due_days').notNull().default(3),
  handlingDueAt:         timestamp('handling_due_at', { withTimezone: true }),
  isLateShipment:        boolean('is_late_shipment').notNull().default(false),

  // Buyer note
  buyerNote:             text('buyer_note'),
  isGift:                boolean('is_gift').notNull().default(false),
  giftMessage:           text('gift_message'),

  // Stripe
  paymentIntentId:       text('payment_intent_id'),
  checkoutSessionId:     text('checkout_session_id'),

  // Cancel
  canceledByUserId:      text('canceled_by_user_id'),
  cancelInitiator:       cancelInitiatorEnum('cancel_initiator'),
  cancelReason:          text('cancel_reason'),
  cancelCountsAsDefect:  boolean('cancel_counts_as_defect').notNull().default(false),

  // Lifecycle timestamps
  paidAt:                timestamp('paid_at', { withTimezone: true }),
  shippedAt:             timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:           timestamp('delivered_at', { withTimezone: true }),
  completedAt:           timestamp('completed_at', { withTimezone: true }),
  canceledAt:            timestamp('canceled_at', { withTimezone: true }),
  expectedShipByAt:      timestamp('expected_ship_by_at', { withTimezone: true }),
  expectedDeliveryAt:    timestamp('expected_delivery_at', { withTimezone: true }),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  buyerIdx:        index('ord_buyer').on(table.buyerId, table.createdAt),
  sellerIdx:       index('ord_seller').on(table.sellerId, table.createdAt),
  statusIdx:       index('ord_status').on(table.status),
  orderNumIdx:     index('ord_number').on(table.orderNumber),
  paymentIntentIdx: index('ord_pi').on(table.paymentIntentId),
}));

// §6.4 orderItem
export const orderItem = pgTable('order_item', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id),
  listingSnapshotJson: jsonb('listing_snapshot_json').notNull().default(sql`'{}'`),
  title:               text('title').notNull(),
  quantity:            integer('quantity').notNull(),
  unitPriceCents:      integer('unit_price_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  // Per-item TF (Transaction Fee, populated during order creation)
  // v3.2: TF columns (progressive bracket-based)
  tfRateBps:           integer('tf_rate_bps'),
  tfAmountCents:       integer('tf_amount_cents'),
  feeBucket:           feeBucketEnum('fee_bucket'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('oi_order').on(table.orderId),
  listingIdx:  index('oi_listing').on(table.listingId),
}));

// §6.5 orderPayment
export const orderPayment = pgTable('order_payment', {
  id:                     text('id').primaryKey().$defaultFn(() => createId()),
  orderId:                text('order_id').notNull().unique().references(() => order.id, { onDelete: 'cascade' }),
  stripePaymentIntentId:  text('stripe_payment_intent_id'),
  stripeChargeId:         text('stripe_charge_id'),
  status:                 text('status').notNull().default('pending'),
  amountCents:            integer('amount_cents').notNull(),
  stripeFeesCents:        integer('stripe_fees_cents'),
  // v3.2: TF columns (progressive bracket-based)
  tfAmountCents:          integer('tf_amount_cents'),
  tfRateBps:              integer('tf_rate_bps'),
  boostFeeAmountCents:    integer('boost_fee_amount_cents'),
  boostRateBps:           integer('boost_rate_bps'),
  netToSellerCents:       integer('net_to_seller_cents'),
  currency:               text('currency').notNull().default('USD'),
  capturedAt:             timestamp('captured_at', { withTimezone: true }),
  refundedAt:             timestamp('refunded_at', { withTimezone: true }),
  refundAmountCents:      integer('refund_amount_cents'),
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
