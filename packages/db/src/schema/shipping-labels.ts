import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { labelStatusEnum } from './enums';
import { user } from './auth';
import { order } from './commerce';

// shipping_label table - Provider-agnostic label record
export const shippingLabel = pgTable('shipping_label', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  orderId:               text('order_id').notNull().references(() => order.id, { onDelete: 'restrict' }),
  shipmentId:            text('shipment_id'), // FK to shipment added at migration level to avoid circular import
  sellerId:              text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),

  // Provider references (Shippo primary)
  provider:              text('provider').notNull().default('shippo'),
  providerLabelId:       text('provider_label_id').notNull(),
  providerRateId:        text('provider_rate_id').notNull(),
  providerShipmentId:    text('provider_shipment_id'),

  // Label details
  status:                labelStatusEnum('status').notNull().default('PURCHASED'),
  carrier:               text('carrier').notNull(),
  carrierAccountId:      text('carrier_account_id'),
  service:               text('service').notNull(),
  trackingNumber:        text('tracking_number').notNull(),
  labelUrl:              text('label_url').notNull(),
  labelFormat:           text('label_format').notNull().default('PDF'),

  // Cost (integer cents, never floats)
  rateCents:             integer('rate_cents').notNull(),
  surchargesCents:       integer('surcharges_cents').notNull().default(0),
  insuranceCostCents:    integer('insurance_cost_cents').notNull().default(0),
  totalCostCents:        integer('total_cost_cents').notNull(),
  platformMarkupCents:   integer('platform_markup_cents').notNull().default(0),
  platformDiscountCents: integer('platform_discount_cents').notNull().default(0),
  sellerPaidCents:       integer('seller_paid_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),

  // Retail comparison
  retailRateCents:       integer('retail_rate_cents'),
  savingsCents:          integer('savings_cents'),

  // Ledger correlation
  ledgerEntryId:         text('ledger_entry_id'),
  refundLedgerEntryId:   text('refund_ledger_entry_id'),

  // Idempotency
  idempotencyKey:        text('idempotency_key').notNull(),

  // Address snapshots (immutable at purchase time)
  fromAddressJson:       jsonb('from_address_json').notNull(),
  toAddressJson:         jsonb('to_address_json').notNull(),

  // Parcel details
  weightOz:              integer('weight_oz'),
  lengthIn:              integer('length_in'),
  widthIn:               integer('width_in'),
  heightIn:              integer('height_in'),
  packageType:           text('package_type').notNull().default('CUSTOM'),

  // Insurance
  isInsured:             boolean('is_insured').notNull().default(false),
  insuredValueCents:     integer('insured_value_cents'),

  // Signature
  signatureRequired:     boolean('signature_required').notNull().default(false),
  signatureType:         text('signature_type'),

  // Manifest
  manifestId:            text('manifest_id'),

  // Return label
  isReturnLabel:         boolean('is_return_label').notNull().default(false),
  returnRequestId:       text('return_request_id'),
  returnShippingPayer:   text('return_shipping_payer'),

  // Lifecycle
  purchasedAt:           timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  printedAt:             timestamp('printed_at', { withTimezone: true }),
  firstScanAt:           timestamp('first_scan_at', { withTimezone: true }),
  voidedAt:              timestamp('voided_at', { withTimezone: true }),
  refundedAt:            timestamp('refunded_at', { withTimezone: true }),
  expiresAt:             timestamp('expires_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:        index('sl_order').on(table.orderId),
  sellerIdx:       index('sl_seller').on(table.sellerId, table.status),
  statusIdx:       index('sl_status').on(table.status, table.createdAt),
  trackingIdx:     index('sl_tracking').on(table.trackingNumber),
  providerIdx:     uniqueIndex('sl_provider_label').on(table.provider, table.providerLabelId),
  idempotencyIdx:  uniqueIndex('sl_idempotency').on(table.idempotencyKey),
  manifestIdx:     index('sl_manifest').on(table.manifestId),
}));
// shipping_rate table - Cached rate quotes with session grouping
export const shippingRate = pgTable('shipping_rate', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  orderId:               text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  sellerId:              text('seller_id').notNull(),
  sessionId:             text('session_id').notNull(),

  // Provider
  provider:              text('provider').notNull().default('shippo'),
  providerRateId:        text('provider_rate_id').notNull(),

  // Carrier & service
  carrier:               text('carrier').notNull(),
  carrierCode:           text('carrier_code').notNull(),
  service:               text('service').notNull(),
  serviceCode:           text('service_code').notNull(),

  // Cost (integer cents)
  rateCents:             integer('rate_cents').notNull(),
  surchargesCents:       integer('surcharges_cents').notNull().default(0),
  totalCents:            integer('total_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),

  // Retail comparison
  retailRateCents:       integer('retail_rate_cents'),
  savingsPercent:        integer('savings_percent'),

  // Delivery estimate
  etaDays:               integer('eta_days'),
  etaBusinessDays:       integer('eta_business_days'),
  guaranteedDelivery:    boolean('guaranteed_delivery').notNull().default(false),

  // Features
  trackingIncluded:      boolean('tracking_included').notNull().default(true),
  insuranceIncluded:     boolean('insurance_included').notNull().default(false),
  signatureIncluded:     boolean('signature_included').notNull().default(false),

  // Selection flags
  isSelected:            boolean('is_selected').notNull().default(false),
  isRecommended:         boolean('is_recommended').notNull().default(false),
  recommendationTag:     text('recommendation_tag'),

  // Address context
  fromPostalCode:        text('from_postal_code').notNull(),
  toPostalCode:          text('to_postal_code').notNull(),
  weightOz:              integer('weight_oz').notNull(),

  // Validity
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderSessionIdx:  index('sr_order_session').on(table.orderId, table.sessionId),
  expiresIdx:       index('sr_expires').on(table.expiresAt),
  carrierIdx:       index('sr_carrier').on(table.carrier, table.serviceCode),
}));

// shipping_manifest table - Batch manifest records per carrier/date
export const shippingManifest = pgTable('shipping_manifest', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:              text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  provider:              text('provider').notNull().default('shippo'),
  providerManifestId:    text('provider_manifest_id'),

  carrier:               text('carrier').notNull(),
  labelCount:            integer('label_count').notNull().default(0),
  status:                text('status').notNull().default('PENDING'),
  manifestUrl:           text('manifest_url'),

  shipDate:              timestamp('ship_date', { withTimezone: true }).notNull(),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:  index('sm_seller').on(table.sellerId, table.shipDate),
  statusIdx:  index('sm_status').on(table.status),
}));
