/**
 * Sale webhook handler — normalizes incoming webhook payloads to DetectedSale.
 * Source: F5-S1 install prompt §1.3; Lister Canonical §12 (sale detection)
 *
 * For V3 launch: eBay webhook handler implemented.
 * Poshmark/Mercari use polling (no webhooks).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { channelProjection } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { handleDetectedSale } from '../services/sale-detection';
import { getPlatformFeeRate, calculatePlatformFee } from '../services/platform-fees';
import type { DetectedSale } from '../services/sale-detection';
import { WhatnotOrderCompletedDataSchema } from '../connectors/whatnot-schemas';
import { parseMoneyToCents } from '../connectors/whatnot-normalizer';
import type { WhatnotWebhookEnvelope } from '../connectors/whatnot-types';
import { ShopifyWebhookOrderSchema } from '../connectors/shopify-schemas';
import { parseShopifyPrice } from '../connectors/shopify-normalizer';

/**
 * Minimal shape of an eBay Marketplace Account Deletion / Order notification.
 * eBay sends these via Marketplace Account Deletion and Notification API.
 * Source: eBay Developer documentation — Order Notification payload.
 */
export interface EbayOrderNotification {
  /** eBay's order ID (e.g. "12-12345-67890") */
  orderId: string;
  /** The SKU or listing ID for the sold item */
  listingId: string;
  /** Sale price as a decimal string (e.g. "49.99") */
  salePrice: string;
  /** Currency code (e.g. "USD") */
  currency: string;
  /** Buyer's eBay username */
  buyerUsername?: string;
  /** ISO 8601 timestamp of when the sale occurred */
  soldAt: string;
}

/**
 * Handle an eBay sale webhook notification.
 * Normalizes the eBay-specific payload to DetectedSale and calls handleDetectedSale.
 *
 * If the listing is not managed by Twicely, the webhook is silently ignored.
 */
export async function handleEbaySaleWebhook(payload: EbayOrderNotification): Promise<void> {
  const { orderId, listingId: externalListingId, salePrice, buyerUsername, soldAt } = payload;

  logger.info('[saleWebhookHandler] eBay sale webhook received', {
    orderId,
    externalListingId,
  });

  // Convert sale price from decimal string to integer cents
  const salePriceCents = Math.round(parseFloat(salePrice) * 100);

  if (isNaN(salePriceCents) || salePriceCents <= 0) {
    logger.warn('[saleWebhookHandler] Invalid sale price in eBay webhook', { salePrice, orderId });
    return;
  }

  // Look up the channel_projection by externalId + channel
  const [proj] = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
      status: channelProjection.status,
    })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.channel, 'EBAY'),
        eq(channelProjection.externalId, externalListingId),
      ),
    )
    .limit(1);

  if (!proj) {
    // Listing not managed by Twicely — skip silently
    logger.info('[saleWebhookHandler] eBay listing not found in Twicely — skipping', {
      externalListingId,
      orderId,
    });
    return;
  }

  // Compute platform fee from settings
  const feeRateBps = await getPlatformFeeRate('EBAY');
  const platformFeeCents = calculatePlatformFee(salePriceCents, feeRateBps);

  const detectedSale: DetectedSale = {
    listingId: proj.listingId,
    projectionId: proj.id,
    channel: 'EBAY',
    externalOrderId: orderId,
    salePriceCents,
    platformFeeCents,
    buyerUsername,
    soldAt: new Date(soldAt),
  };

  await handleDetectedSale(detectedSale);
}

/**
 * Handle a Whatnot order.completed webhook event.
 * Normalizes the Whatnot-specific payload to DetectedSale and calls handleDetectedSale.
 *
 * If the listing is not managed by Twicely, the webhook is silently ignored.
 * Pattern mirrors handleEbaySaleWebhook exactly.
 */
export async function handleWhatnotSaleWebhook(envelope: WhatnotWebhookEnvelope): Promise<void> {
  const parsed = WhatnotOrderCompletedDataSchema.safeParse(envelope.data);

  if (!parsed.success) {
    logger.warn('[saleWebhookHandler] Invalid Whatnot order.completed data', {
      eventId: envelope.eventId,
      error: parsed.error.message,
    });
    return;
  }

  const data = parsed.data;

  logger.info('[saleWebhookHandler] Whatnot sale webhook received', {
    eventId: envelope.eventId,
    orderId: data.orderId,
    externalListingId: data.listingId,
  });

  // Convert Whatnot Money type { amount: "49.99" } to integer cents
  const salePriceCents = parseMoneyToCents(data.price.amount);

  if (isNaN(salePriceCents) || salePriceCents <= 0) {
    logger.warn('[saleWebhookHandler] Invalid sale price in Whatnot webhook', {
      amount: data.price.amount,
      orderId: data.orderId,
      eventId: envelope.eventId,
    });
    return;
  }

  // Look up the channel_projection by externalId + channel
  const [proj] = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
      status: channelProjection.status,
    })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.channel, 'WHATNOT'),
        eq(channelProjection.externalId, data.listingId),
      ),
    )
    .limit(1);

  if (!proj) {
    // Listing not managed by Twicely — skip silently
    logger.info('[saleWebhookHandler] Whatnot listing not found in Twicely — skipping', {
      externalListingId: data.listingId,
      orderId: data.orderId,
      eventId: envelope.eventId,
    });
    return;
  }

  // Compute platform fee from settings
  const feeRateBps = await getPlatformFeeRate('WHATNOT');
  const platformFeeCents = calculatePlatformFee(salePriceCents, feeRateBps);

  const detectedSale: DetectedSale = {
    listingId: proj.listingId,
    projectionId: proj.id,
    channel: 'WHATNOT',
    externalOrderId: data.orderId,
    salePriceCents,
    platformFeeCents,
    buyerUsername: data.buyer.username,
    soldAt: new Date(data.completedAt),
  };

  await handleDetectedSale(detectedSale);
}

/**
 * Handle a Shopify orders/create or orders/paid webhook event.
 * Shopify orders can contain MULTIPLE line items — each is processed independently.
 * Normalizes the Shopify-specific payload to DetectedSale and calls handleDetectedSale.
 *
 * If a line item is not managed by Twicely, it is silently ignored.
 * Pattern mirrors handleWhatnotSaleWebhook exactly.
 */
export async function handleShopifySaleWebhook(shopDomain: string, body: unknown): Promise<void> {
  const parsed = ShopifyWebhookOrderSchema.safeParse(body);

  if (!parsed.success) {
    logger.warn('[saleWebhookHandler] Invalid Shopify order payload', {
      shopDomain,
      error: parsed.error.message,
    });
    return;
  }

  const order = parsed.data;

  logger.info('[saleWebhookHandler] Shopify sale webhook received', {
    orderId: order.id,
    shopDomain,
    lineItemCount: order.line_items.length,
  });

  // Process each line item independently — Shopify orders can be multi-item
  for (const lineItem of order.line_items) {
    // Skip custom line items (no Shopify product_id)
    if (lineItem.product_id === null) {
      continue;
    }

    const externalId = String(lineItem.product_id);

    // Look up channel_projection by externalId + SHOPIFY channel
    const [proj] = await db
      .select({
        id: channelProjection.id,
        listingId: channelProjection.listingId,
        status: channelProjection.status,
      })
      .from(channelProjection)
      .where(
        and(
          eq(channelProjection.channel, 'SHOPIFY'),
          eq(channelProjection.externalId, externalId),
        ),
      )
      .limit(1);

    if (!proj) {
      // Not managed by Twicely — skip silently
      logger.info('[saleWebhookHandler] Shopify product not found in Twicely — skipping', {
        externalId,
        orderId: order.id,
        shopDomain,
      });
      continue;
    }

    // Use per-line-item price (NOT total_price which covers all items + shipping + tax)
    const salePriceCents = parseShopifyPrice(lineItem.price);

    if (isNaN(salePriceCents) || salePriceCents <= 0) {
      logger.warn('[saleWebhookHandler] Invalid sale price in Shopify webhook line item', {
        price: lineItem.price,
        orderId: order.id,
        externalId,
        shopDomain,
      });
      continue;
    }

    // Compute platform fee from settings
    const feeRateBps = await getPlatformFeeRate('SHOPIFY');
    const platformFeeCents = calculatePlatformFee(salePriceCents, feeRateBps);

    const buyerUsername =
      order.customer?.email ?? order.customer?.first_name ?? undefined;

    const detectedSale: DetectedSale = {
      listingId: proj.listingId,
      projectionId: proj.id,
      channel: 'SHOPIFY',
      externalOrderId: String(order.id),
      salePriceCents,
      platformFeeCents,
      buyerUsername,
      soldAt: new Date(order.created_at),
    };

    await handleDetectedSale(detectedSale);
  }
}
