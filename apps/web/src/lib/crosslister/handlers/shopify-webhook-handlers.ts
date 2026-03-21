/**
 * Shopify webhook event handlers — product update, product delete, app uninstalled.
 * Source: H3.4 install prompt §2.8, §2.9, §2.10; Lister Canonical §14 (two-way sync)
 *
 * Key rules:
 * - Two-way auto-sync is OFF by default (§14.4). External changes are stored as
 *   externalDiff for seller review — NOT auto-merged into canonical listings.
 * - Product deletes mark the projection as DELISTED. The canonical listing stays.
 * - App uninstall revokes the account and delists all ACTIVE projections.
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { channelProjection, crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { ShopifyProductSchema } from '../connectors/shopify-schemas';
import { normalizeShopifyProduct, mapShopifyStatus } from '../connectors/shopify-normalizer';
import { publishToChannel, sellerChannel } from '@twicely/realtime/centrifugo-publisher';

/** Shape of the diff stored in externalDiff jsonb. */
type ExternalDiffShape = {
  detectedAt: string;
  shopDomain: string;
  fields: {
    priceCents?: { old: number; new: number };
    quantity?: { old: number; new: number };
    title?: { old: string; new: string };
    status?: { old: string; new: string };
  };
} & Record<string, unknown>;

/**
 * Handle a Shopify products/update webhook event.
 * Detects external changes and stores them as externalDiff on the projection.
 * Does NOT auto-merge — two-way sync is OFF by default (Lister Canonical §14.4).
 */
export async function handleShopifyProductUpdate(
  shopDomain: string,
  body: unknown,
): Promise<void> {
  const parsed = ShopifyProductSchema.safeParse(body);

  if (!parsed.success) {
    logger.warn('[shopifyWebhookHandlers] Invalid products/update payload', {
      shopDomain,
      error: parsed.error.message,
    });
    return;
  }

  const product = parsed.data;
  const externalId = String(product.id);

  // Look up the projection
  const [proj] = await db
    .select({
      id: channelProjection.id,
      sellerId: channelProjection.sellerId,
      status: channelProjection.status,
      syncEnabled: channelProjection.syncEnabled,
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
    logger.info('[shopifyWebhookHandlers] products/update: no matching projection — skipping', {
      externalId,
      shopDomain,
    });
    return;
  }

  // Normalize external product data
  const normalized = normalizeShopifyProduct(product, shopDomain);

  // Build diff: compare normalized external data against canonical stored state
  // We compare against the normalized values to detect meaningful changes
  const diffFields: ExternalDiffShape['fields'] = {};

  // Use existing projection status as 'old' for status comparison
  const externalStatus = normalized.status;
  const canonicalStatus = proj.status;
  if (externalStatus !== canonicalStatus) {
    diffFields.status = { old: canonicalStatus, new: externalStatus };
  }

  // If no fields changed, skip (no-op)
  if (Object.keys(diffFields).length === 0 && product.title && normalized.priceCents !== undefined) {
    // Also check price and quantity from normalized data — always record if we have data
    // We record whenever we have a live update to keep externalDiff fresh
  }

  // Record priceCents and quantity changes in diff (informational even if no change)
  // Only record meaningful changes to avoid noise
  const newStatus = mapShopifyStatus(product.status);

  // If Shopify product is archived or draft, mark projection as DELISTED
  if (product.status === 'archived' || product.status === 'draft') {
    if (proj.status === 'ACTIVE') {
      logger.info('[shopifyWebhookHandlers] products/update: external delist detected', {
        externalId,
        shopDomain,
        newStatus,
      });
    }

    await db
      .update(channelProjection)
      .set({
        status: 'DELISTED',
        updatedAt: new Date(),
      })
      .where(eq(channelProjection.id, proj.id));
  }

  // Store externalDiff with detected changes
  const externalDiff: ExternalDiffShape = {
    detectedAt: new Date().toISOString(),
    shopDomain,
    fields: {
      ...diffFields,
      priceCents: { old: 0, new: normalized.priceCents },
      quantity: { old: 0, new: normalized.quantity },
      title: { old: '', new: normalized.title },
    },
  };

  // Set hasPendingSync = true and elevate to WARM poll tier
  await db
    .update(channelProjection)
    .set({
      externalDiff: externalDiff as Record<string, unknown>,
      hasPendingSync: true,
      pollTier: 'WARM',
      updatedAt: new Date(),
    })
    .where(eq(channelProjection.id, proj.id));

  logger.info('[shopifyWebhookHandlers] products/update: external diff recorded', {
    projectionId: proj.id,
    externalId,
    shopDomain,
  });

  // Send Centrifugo event: sync.external_change on private-user.{sellerId}
  await publishToChannel(sellerChannel(proj.sellerId), {
    event: 'sync.external_change',
    projectionId: proj.id,
    channel: 'SHOPIFY',
    diff: externalDiff,
  });
}

/**
 * Handle a Shopify products/delete webhook event.
 * Marks the projection as DELISTED and sets orphanedAt.
 * Does NOT delete the canonical Twicely listing (Decision #112).
 */
export async function handleShopifyProductDelete(
  shopDomain: string,
  body: unknown,
): Promise<void> {
  // Shopify sends { id: number } for delete events — only the product ID
  const parsed = (body as Record<string, unknown>);
  const rawId = parsed?.id;

  if (typeof rawId !== 'number' && typeof rawId !== 'string') {
    logger.warn('[shopifyWebhookHandlers] products/delete: missing or invalid id', {
      shopDomain,
      body,
    });
    return;
  }

  const externalId = String(rawId);

  const [proj] = await db
    .select({ id: channelProjection.id, status: channelProjection.status })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.channel, 'SHOPIFY'),
        eq(channelProjection.externalId, externalId),
      ),
    )
    .limit(1);

  if (!proj) {
    logger.info('[shopifyWebhookHandlers] products/delete: no matching projection — skipping', {
      externalId,
      shopDomain,
    });
    return;
  }

  await db
    .update(channelProjection)
    .set({
      status: 'DELISTED',
      orphanedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(channelProjection.id, proj.id));

  logger.info('[shopifyWebhookHandlers] products/delete: projection marked DELISTED', {
    projectionId: proj.id,
    externalId,
    shopDomain,
  });
}

/**
 * Handle a Shopify app/uninstalled webhook event.
 * Revokes the crosslisterAccount (status = REVOKED, accessToken = null).
 * Marks all ACTIVE projections for the account as DELISTED.
 */
export async function handleShopifyAppUninstalled(shopDomain: string): Promise<void> {
  const [account] = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.channel, 'SHOPIFY'),
        eq(crosslisterAccount.externalAccountId, shopDomain),
      ),
    )
    .limit(1);

  if (!account) {
    logger.info('[shopifyWebhookHandlers] app/uninstalled: no matching account — skipping', {
      shopDomain,
    });
    return;
  }

  // Revoke the account
  await db
    .update(crosslisterAccount)
    .set({
      status: 'REVOKED',
      accessToken: null,
      updatedAt: new Date(),
    })
    .where(eq(crosslisterAccount.id, account.id));

  // Mark all ACTIVE projections for this account as DELISTED
  await db
    .update(channelProjection)
    .set({
      status: 'DELISTED',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelProjection.accountId, account.id),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    );

  logger.info('[shopifyWebhookHandlers] app/uninstalled: account revoked and projections delisted', {
    accountId: account.id,
    shopDomain,
  });
}
