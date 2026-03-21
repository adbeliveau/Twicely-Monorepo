import { pgTable, text, integer, boolean, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { shipmentStatusEnum, returnStatusEnum, returnReasonEnum, returnFaultEnum, returnReasonBucketEnum, disputeStatusEnum, claimTypeEnum } from './enums';
import { user } from './auth';
import { order } from './commerce';

// §7.1 shipment
export const shipment = pgTable('shipment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().unique().references(() => order.id, { onDelete: 'cascade' }),
  carrier:             text('carrier'),
  service:             text('service'),
  tracking:            text('tracking'),
  labelUrl:            text('label_url'),
  status:              shipmentStatusEnum('status').notNull().default('PENDING'),
  shippingCostCents:   integer('shipping_cost_cents'),
  insuranceCostCents:  integer('insurance_cost_cents'),
  weightOz:            real('weight_oz'),
  lengthIn:            real('length_in'),
  widthIn:             real('width_in'),
  heightIn:            real('height_in'),
  lateShipment:        boolean('late_shipment').notNull().default(false),
  fromAddressJson:     jsonb('from_address_json').notNull().default(sql`'{}'`),
  toAddressJson:       jsonb('to_address_json').notNull().default(sql`'{}'`),
  trackingEventsJson:  jsonb('tracking_events_json').notNull().default(sql`'[]'`),
  shippedAt:           timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:         timestamp('delivered_at', { withTimezone: true }),
  expectedDeliveryAt:  timestamp('expected_delivery_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  trackingIdx: index('shp_tracking').on(table.tracking),
  statusIdx:   index('shp_status').on(table.status),
}));

// §7.2 returnRequest
export const returnRequest = pgTable('return_request', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  sellerId:            text('seller_id').notNull(),
  status:              returnStatusEnum('status').notNull().default('PENDING_SELLER'),
  reason:              returnReasonEnum('reason').notNull(),
  fault:               returnFaultEnum('fault'),
  description:         text('description'),
  evidencePhotos:      text('evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  sellerResponseNote:  text('seller_response_note'),
  sellerEvidencePhotos: text('seller_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  partialRefundCents:  integer('partial_refund_cents'),
  refundAmountCents:   integer('refund_amount_cents'),

  // Fee allocation (V2 Returns Fee Allocation Addendum — deterministic refund breakdown)
  bucket:              returnReasonBucketEnum('bucket'),
  refundItemCents:     integer('refund_item_cents'),
  refundShippingCents: integer('refund_shipping_cents'),
  refundTaxCents:      integer('refund_tax_cents'),
  restockingFeeCents:  integer('restocking_fee_cents'),
  feeAllocationJson:   jsonb('fee_allocation_json').notNull().default('{}'),

  // Return shipping
  returnTrackingNumber: text('return_tracking_number'),
  returnCarrier:       text('return_carrier'),
  returnLabelUrl:      text('return_label_url'),
  returnShippingPaidBy: text('return_shipping_paid_by'),

  sellerResponseDueAt: timestamp('seller_response_due_at', { withTimezone: true }),
  sellerRespondedAt:   timestamp('seller_responded_at', { withTimezone: true }),
  shippedAt:           timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:         timestamp('delivered_at', { withTimezone: true }),
  refundedAt:          timestamp('refunded_at', { withTimezone: true }),
  escalatedAt:         timestamp('escalated_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('rr_order').on(table.orderId),
  buyerIdx:    index('rr_buyer').on(table.buyerId),
  sellerIdx:   index('rr_seller').on(table.sellerId),
  statusIdx:   index('rr_status').on(table.status),
}));

// §7.3 dispute
export const dispute = pgTable('dispute', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  sellerId:            text('seller_id').notNull(),
  returnRequestId:     text('return_request_id').references(() => returnRequest.id),
  claimType:           claimTypeEnum('claim_type').notNull(),
  status:              disputeStatusEnum('status').notNull().default('OPEN'),
  description:         text('description').notNull(),
  evidencePhotos:      text('evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  sellerResponseNote:  text('seller_response_note'),
  sellerEvidencePhotos: text('seller_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  resolutionNote:      text('resolution_note'),
  resolutionAmountCents: integer('resolution_amount_cents'),
  resolvedByStaffId:   text('resolved_by_staff_id'),
  appealNote:          text('appeal_note'),
  appealEvidencePhotos: text('appeal_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  appealResolvedNote:  text('appeal_resolved_note'),
  deadlineAt:          timestamp('deadline_at', { withTimezone: true }),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  appealedAt:          timestamp('appealed_at', { withTimezone: true }),
  appealResolvedAt:    timestamp('appeal_resolved_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('dsp_order').on(table.orderId),
  buyerIdx:    index('dsp_buyer').on(table.buyerId),
  sellerIdx:   index('dsp_seller').on(table.sellerId),
  statusIdx:   index('dsp_status').on(table.status),
}));
