/**
 * Unit tests for Shopify webhook route.
 * Source: H3.4 install prompt §5 (Unit Tests — Webhook Route)
 *
 * Pattern mirrors Whatnot webhook route tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/crosslister/connectors/shopify-webhook-verify', () => ({
  SHOPIFY_SIGNATURE_HEADER: 'X-Shopify-Hmac-Sha256',
  verifyShopifyWebhookSignature: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@twicely/crosslister/handlers/sale-webhook-handler', () => ({
  handleShopifySaleWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/crosslister/handlers/shopify-webhook-handlers', () => ({
  handleShopifyProductUpdate: vi.fn().mockResolvedValue(undefined),
  handleShopifyProductDelete: vi.fn().mockResolvedValue(undefined),
  handleShopifyAppUninstalled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { verifyShopifyWebhookSignature } from '@twicely/crosslister/connectors/shopify-webhook-verify';
import { handleShopifySaleWebhook } from '@twicely/crosslister/handlers/sale-webhook-handler';
import {
  handleShopifyProductUpdate,
  handleShopifyProductDelete,
  handleShopifyAppUninstalled,
} from '@twicely/crosslister/handlers/shopify-webhook-handlers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a NextRequest with Shopify webhook headers */
function makeRequest(
  body: string,
  topic: string,
  options: {
    hmacHeader?: string;
    shopDomain?: string;
    webhookId?: string;
  } = {},
): NextRequest {
  const {
    hmacHeader = 'valid-base64-signature',
    shopDomain = 'mystore.myshopify.com',
    webhookId = 'wh-001',
  } = options;

  return new NextRequest('https://twicely.co/api/crosslister/shopify/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': hmacHeader,
      'X-Shopify-Topic': topic,
      'X-Shopify-Shop-Domain': shopDomain,
      'X-Shopify-Webhook-Id': webhookId,
    },
    body,
  });
}

/** Build a valid Shopify product payload */
function makeProductBody(): string {
  return JSON.stringify({
    id: 12345,
    title: 'Test Product',
    body_html: '<p>Description</p>',
    vendor: '',
    product_type: '',
    status: 'active',
    tags: '',
    variants: [{ id: 99001, product_id: 12345, title: 'Default', price: '49.99', sku: null, inventory_quantity: 5, weight: null, weight_unit: null, barcode: null }],
    images: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    handle: 'test-product',
  });
}

/** Build a valid Shopify order payload */
function makeOrderBody(): string {
  return JSON.stringify({
    id: 5001001001,
    name: '#1001',
    financial_status: 'paid',
    fulfillment_status: null,
    total_price: '49.99',
    currency: 'USD',
    line_items: [{ id: 9001, product_id: 12345, variant_id: 99001, title: 'Test', quantity: 1, price: '49.99' }],
    customer: { id: 7001, email: 'buyer@example.com', first_name: 'Jane', last_name: 'Doe' },
    created_at: '2025-01-15T12:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/crosslister/shopify/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default: signature valid
    vi.mocked(verifyShopifyWebhookSignature).mockResolvedValue({ valid: true });
  });

  it('returns 200 { received: true } for valid signature + products/update topic', async () => {
    const { POST } = await import('../route');

    const request = makeRequest(makeProductBody(), 'products/update');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('returns 200 { received: true } for valid signature + orders/create topic', async () => {
    const { POST } = await import('../route');

    const request = makeRequest(makeOrderBody(), 'orders/create');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('returns 400 when X-Shopify-Hmac-Sha256 header is missing', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('https://twicely.co/api/crosslister/shopify/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/update',
        'X-Shopify-Shop-Domain': 'mystore.myshopify.com',
        // No X-Shopify-Hmac-Sha256 header
      },
      body: makeProductBody(),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when signature is invalid', async () => {
    vi.mocked(verifyShopifyWebhookSignature).mockResolvedValue({
      valid: false,
      error: 'Invalid signature',
    });

    const { POST } = await import('../route');

    const request = makeRequest(makeProductBody(), 'products/update', {
      hmacHeader: 'tampered-signature',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const { POST } = await import('../route');

    const request = makeRequest('not-valid-json', 'products/update');
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 200 for unknown topic (acknowledges silently)', async () => {
    const { POST } = await import('../route');

    const request = makeRequest('{}', 'unknown/topic');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('returns 200 even when handler throws (prevents retry storms)', async () => {
    vi.mocked(handleShopifyProductUpdate).mockRejectedValueOnce(new Error('DB error'));

    const { POST } = await import('../route');

    const request = makeRequest(makeProductBody(), 'products/update');
    const response = await POST(request);

    // Must still return 200 — no retry storms
    expect(response.status).toBe(200);
  });

  it('calls handleShopifyProductUpdate for products/update topic', async () => {
    const { POST } = await import('../route');

    const request = makeRequest(makeProductBody(), 'products/update');
    await POST(request);

    expect(handleShopifyProductUpdate).toHaveBeenCalledOnce();
  });

  it('calls handleShopifySaleWebhook for orders/create topic', async () => {
    const { POST } = await import('../route');

    const request = makeRequest(makeOrderBody(), 'orders/create');
    await POST(request);

    expect(handleShopifySaleWebhook).toHaveBeenCalledOnce();
  });

  it('calls handleShopifyProductDelete for products/delete topic', async () => {
    const { POST } = await import('../route');

    const request = makeRequest(JSON.stringify({ id: 12345 }), 'products/delete');
    await POST(request);

    expect(handleShopifyProductDelete).toHaveBeenCalledOnce();
  });

  it('does NOT call any handler when signature verification fails', async () => {
    vi.mocked(verifyShopifyWebhookSignature).mockResolvedValue({
      valid: false,
      error: 'Invalid signature',
    });

    const { POST } = await import('../route');

    const request = makeRequest(makeProductBody(), 'products/update', {
      hmacHeader: 'bad-signature',
    });
    await POST(request);

    expect(handleShopifyProductUpdate).not.toHaveBeenCalled();
    expect(handleShopifySaleWebhook).not.toHaveBeenCalled();
    expect(handleShopifyProductDelete).not.toHaveBeenCalled();
    expect(handleShopifyAppUninstalled).not.toHaveBeenCalled();
  });
});
