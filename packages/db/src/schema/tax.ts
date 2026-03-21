import { pgTable, text, integer, boolean, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { order } from './commerce';

// §17.1 taxInfo (Seller Tax Data)
export const taxInfo = pgTable('tax_info', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  taxIdType:           text('tax_id_type'),
  taxIdEncrypted:      text('tax_id_encrypted'),
  taxIdLastFour:       text('tax_id_last_four'),
  legalName:           text('legal_name'),
  businessName:        text('business_name'),
  address1:            text('address1'),
  city:                text('city'),
  state:               text('state'),
  zip:                 text('zip'),
  country:             text('country').notNull().default('US'),
  w9ReceivedAt:        timestamp('w9_received_at', { withTimezone: true }),
  form1099Threshold:   boolean('form_1099_threshold').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §17.2 taxQuote
export const taxQuote = pgTable('tax_quote', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').references(() => order.id),
  buyerState:          text('buyer_state').notNull(),
  sellerState:         text('seller_state'),
  subtotalCents:       integer('subtotal_cents').notNull(),
  shippingCents:       integer('shipping_cents').notNull().default(0),
  taxCents:            integer('tax_cents').notNull(),
  taxRatePercent:      real('tax_rate_percent').notNull(),
  jurisdictionJson:    jsonb('jurisdiction_json').notNull().default(sql`'{}'`),
  isMarketplaceFacilitator: boolean('is_marketplace_facilitator').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:            index('tq_order').on(table.orderId),
}));
