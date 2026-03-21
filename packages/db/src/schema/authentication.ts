import { pgTable, text, integer, boolean, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { authenticationStatusEnum } from './enums';
import { user } from './auth';
import { listing } from './listings';

export const authenticatorPartner = pgTable('authenticator_partner', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  name:                  text('name').notNull(),
  email:                 text('email').notNull(),
  specialties:           text('specialties').array().notNull(),
  isActive:              boolean('is_active').notNull().default(true),
  completedCount:        integer('completed_count').notNull().default(0),
  accuracyRate:          real('accuracy_rate'),
  avgTurnaroundHours:    real('avg_turnaround_hours'),
  payoutAccountId:       text('payout_account_id'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authenticationRequest = pgTable('authentication_request', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id),
  orderId:               text('order_id'),
  sellerId:              text('seller_id').notNull().references(() => user.id),
  buyerId:               text('buyer_id'),
  initiator:             text('initiator').notNull(),
  tier:                  text('tier').notNull(),
  status:                authenticationStatusEnum('status').notNull(),
  totalFeeCents:         integer('total_fee_cents').notNull(),
  buyerFeeCents:         integer('buyer_fee_cents'),
  sellerFeeCents:        integer('seller_fee_cents'),
  refundedBuyerCents:    integer('refunded_buyer_cents').notNull().default(0),
  providerRef:           text('provider_ref'),
  authenticatorId:       text('authenticator_id').references(() => authenticatorPartner.id),
  certificateNumber:     text('certificate_number').unique(),
  certificateUrl:        text('certificate_url'),
  verifyUrl:             text('verify_url'),
  photosHash:            text('photos_hash'),
  photoUrls:             text('photo_urls').array(),
  resultJson:            jsonb('result_json'),
  resultNotes:           text('result_notes'),
  submittedAt:           timestamp('submitted_at', { withTimezone: true }),
  completedAt:           timestamp('completed_at', { withTimezone: true }),
  expiresAt:             timestamp('expires_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('ar_listing').on(table.listingId),
  sellerIdx:             index('ar_seller').on(table.sellerId),
  certIdx:               index('ar_cert').on(table.certificateNumber),
  statusIdx:             index('ar_status').on(table.status),
}));
