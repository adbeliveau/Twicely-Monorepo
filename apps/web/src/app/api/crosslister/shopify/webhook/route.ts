/**
 * Shopify webhook endpoint.
 * Endpoint: POST /api/crosslister/shopify/webhook
 * Source: H3.4 install prompt §2.6; Lister Canonical §13.5, §24.5
 *
 * Authentication: HMAC-SHA256 signature verification only.
 * No session/CASL auth — this is a platform-to-platform webhook.
 *
 * Returns 200 even on handler errors (prevent retry storms per §24.5).
 *
 * Key differences from Whatnot webhook route:
 * - Signature header: X-Shopify-Hmac-Sha256 (Base64 encoded)
 * - Topic comes from X-Shopify-Topic header (not body field)
 * - Body IS the resource directly (product or order), not an envelope
 * - Shop domain from X-Shopify-Shop-Domain header
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@twicely/logger';
import {
  verifyShopifyWebhookSignature,
  SHOPIFY_SIGNATURE_HEADER,
} from '@twicely/crosslister/connectors/shopify-webhook-verify';
import { handleShopifySaleWebhook } from '@twicely/crosslister/handlers/sale-webhook-handler';
import {
  handleShopifyProductUpdate,
  handleShopifyProductDelete,
  handleShopifyAppUninstalled,
} from '@twicely/crosslister/handlers/shopify-webhook-handlers';
import type { ShopifyWebhookTopic } from '@twicely/crosslister/connectors/shopify-types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read raw body before any JSON parsing (required for HMAC verification)
  const rawBody = await request.text();

  // Verify HMAC signature header is present
  const signatureHeader = request.headers.get(SHOPIFY_SIGNATURE_HEADER);
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
  }

  // Verify HMAC-SHA256 signature (Base64)
  const verification = await verifyShopifyWebhookSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    logger.warn('[shopifyWebhookRoute] Signature verification failed', {
      error: verification.error,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Parse the raw body as JSON
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Extract Shopify-specific headers
  const topic = request.headers.get('X-Shopify-Topic') as ShopifyWebhookTopic | null;
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain') ?? '';
  const webhookId = request.headers.get('X-Shopify-Webhook-Id') ?? '';

  logger.info('[shopifyWebhookRoute] Webhook received', { topic, shopDomain, webhookId });

  // Route by topic — always return 200 even on handler error (§24.5 webhook replay safety)
  switch (topic) {
    case 'products/update':
      try {
        await handleShopifyProductUpdate(shopDomain, parsedBody);
      } catch (err) {
        logger.error('[shopifyWebhookRoute] products/update handler error', {
          shopDomain,
          webhookId,
          error: String(err),
        });
      }
      break;

    case 'products/delete':
      try {
        await handleShopifyProductDelete(shopDomain, parsedBody);
      } catch (err) {
        logger.error('[shopifyWebhookRoute] products/delete handler error', {
          shopDomain,
          webhookId,
          error: String(err),
        });
      }
      break;

    case 'orders/create':
    case 'orders/paid':
      try {
        await handleShopifySaleWebhook(shopDomain, parsedBody);
      } catch (err) {
        logger.error('[shopifyWebhookRoute] orders handler error', {
          topic,
          shopDomain,
          webhookId,
          error: String(err),
        });
      }
      break;

    case 'products/create':
      // Acknowledge only — products created by Twicely's crosslist engine already have
      // projections. Auto-importing every new Shopify product could create unexpected listings.
      logger.info('[shopifyWebhookRoute] products/create — acknowledging only', {
        shopDomain,
        webhookId,
      });
      break;

    case 'app/uninstalled':
      try {
        await handleShopifyAppUninstalled(shopDomain);
      } catch (err) {
        logger.error('[shopifyWebhookRoute] app/uninstalled handler error', {
          shopDomain,
          webhookId,
          error: String(err),
        });
      }
      break;

    default:
      logger.info('[shopifyWebhookRoute] Unhandled topic — acknowledging', {
        topic,
        shopDomain,
        webhookId,
      });
      break;
  }

  // Always return 200 — prevents Shopify retry storms (Lister Canonical §24.5)
  return NextResponse.json({ received: true });
}
