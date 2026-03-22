/**
 * Shopify crosslist helpers — outbound publishing to Shopify Admin REST API.
 * Extracted from ShopifyConnector to keep connector.ts under the 300-line limit.
 * Source: H3.3 install prompt §2.3
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import type { TransformedListing } from '../types';
import type { ShopifyProductInput, ShopifyCreateProductResponse, ShopifyErrorResponse } from '@twicely/crosslister/connectors/shopify-types';
import { parseShopifyPrice, mapShopifyStatus } from '@twicely/crosslister/connectors/shopify-normalizer';
import { ShopifyProductSchema } from '@twicely/crosslister/connectors/shopify-schemas';

interface ShopifyCrosslistConfig { apiVersion: string }

export interface ShopifyCreateResult {
  success: boolean; productId: string | null; handle: string | null;
  error?: string; retryable: boolean; statusCode: number;
}
export interface ShopifyUpdateResult { success: boolean; error?: string; retryable: boolean; statusCode: number }
export interface ShopifyDeleteResult { success: boolean; error?: string; retryable: boolean; statusCode: number }
export interface ShopifyVerifyResult {
  exists: boolean; status: 'ACTIVE' | 'ENDED' | 'REMOVED' | 'UNKNOWN';
  priceCents: number | null; quantity: number | null; lastModifiedAt: Date | null;
}

/**
 * Convert a TransformedListing to the Shopify REST API product creation payload.
 * Images capped to 250 (Shopify actual limit) as a defensive measure.
 */
export function toShopifyProductInput(listing: TransformedListing): ShopifyProductInput {
  const title = listing.title.slice(0, 255);
  const body_html = listing.descriptionHtml
    ? listing.descriptionHtml
    : `<p>${listing.description.slice(0, 5000)}</p>`;
  const vendor = listing.brand ?? '';
  const product_type = listing.category.externalCategoryName ?? '';
  const tags = (listing.itemSpecifics['tags'] as string | undefined) ?? '';
  const price = (listing.priceCents / 100).toFixed(2);
  const sku = (listing.itemSpecifics['sku'] as string | undefined) ?? null;
  const barcode = (listing.itemSpecifics['barcode'] as string | undefined) ?? null;
  const weightOz = listing.shipping.weightOz;
  const sortedImages = [...listing.images].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 250);

  const input: ShopifyProductInput = {
    title, body_html, vendor, product_type, tags, status: 'active',
    variants: [{
      price,
      inventory_quantity: listing.quantity,
      sku, barcode,
      weight: weightOz !== null ? weightOz : null,
      weight_unit: weightOz !== null ? 'oz' : null,
    }],
    images: sortedImages.map((img, idx) => ({ src: img.url, position: idx + 1 })),
  };

  if (listing.condition) {
    input.metafields = [{
      namespace: 'twicely', key: 'condition', value: listing.condition, type: 'single_line_text_field',
    }];
  }
  return input;
}

/**
 * Convert only the changed fields of a TransformedListing to a partial Shopify product input.
 */
export function toShopifyPartialInput(changes: Partial<TransformedListing>): Partial<ShopifyProductInput> {
  const partial: Partial<ShopifyProductInput> = {};

  if (changes.title !== undefined) partial.title = changes.title.slice(0, 255);

  if (changes.descriptionHtml !== undefined || changes.description !== undefined) {
    partial.body_html = changes.descriptionHtml
      ? changes.descriptionHtml
      : `<p>${(changes.description ?? '').slice(0, 5000)}</p>`;
  }

  if (changes.brand !== undefined) partial.vendor = changes.brand ?? '';
  if (changes.category !== undefined) partial.product_type = changes.category.externalCategoryName ?? '';
  if (changes.itemSpecifics !== undefined) {
    partial.tags = (changes.itemSpecifics['tags'] as string | undefined) ?? '';
  }

  if (changes.images !== undefined) {
    partial.images = [...changes.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 250)
      .map((img, idx) => ({ src: img.url, position: idx + 1 }));
  }

  if (changes.priceCents !== undefined || changes.quantity !== undefined) {
    partial.variants = [{
      price: changes.priceCents !== undefined ? (changes.priceCents / 100).toFixed(2) : '0.00',
      inventory_quantity: changes.quantity !== undefined ? changes.quantity : 0,
      sku: null, barcode: null, weight: null, weight_unit: null,
    }];
  }

  return partial;
}

/** POST a new product to Shopify. */
export async function createShopifyProduct(
  config: ShopifyCrosslistConfig,
  shopDomain: string,
  accessToken: string,
  input: ShopifyProductInput,
): Promise<ShopifyCreateResult> {
  const url = `https://${shopDomain}/admin/api/${config.apiVersion}/products.json`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ product: input }),
    });
  } catch (err) {
    return { success: false, productId: null, handle: null, error: String(err), retryable: true, statusCode: 0 };
  }

  if (response.ok) {
    const body = await response.json() as ShopifyCreateProductResponse;
    return { success: true, productId: String(body.product.id), handle: body.product.handle, retryable: false, statusCode: response.status };
  }

  const statusCode = response.status;
  if (statusCode === 401) {
    return { success: false, productId: null, handle: null, error: 'Unauthorized', retryable: false, statusCode };
  }
  if (statusCode === 422) {
    let errorMessage = 'Validation error';
    try {
      const body = await response.json() as ShopifyErrorResponse;
      if (typeof body.errors === 'string') {
        errorMessage = body.errors;
      } else {
        const firstKey = Object.keys(body.errors)[0];
        if (firstKey) errorMessage = body.errors[firstKey]?.[0] ?? errorMessage;
      }
    } catch { /* ignore parse error */ }
    return { success: false, productId: null, handle: null, error: errorMessage, retryable: false, statusCode };
  }
  if (statusCode === 429) {
    return { success: false, productId: null, handle: null, error: 'Rate limited', retryable: true, statusCode };
  }
  return { success: false, productId: null, handle: null, error: `Shopify error ${statusCode}`, retryable: true, statusCode };
}

/** PUT an updated product to Shopify. */
export async function updateShopifyProduct(
  config: ShopifyCrosslistConfig,
  shopDomain: string,
  accessToken: string,
  externalId: string,
  input: Partial<ShopifyProductInput>,
): Promise<ShopifyUpdateResult> {
  const url = `https://${shopDomain}/admin/api/${config.apiVersion}/products/${externalId}.json`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ product: input }),
    });
  } catch (err) {
    return { success: false, error: String(err), retryable: true, statusCode: 0 };
  }

  if (response.ok) return { success: true, retryable: false, statusCode: response.status };
  const statusCode = response.status;
  if (statusCode === 401) return { success: false, error: 'Unauthorized', retryable: false, statusCode };
  if (statusCode === 422) return { success: false, error: 'Validation error', retryable: false, statusCode };
  if (statusCode === 429) return { success: false, error: 'Rate limited', retryable: true, statusCode };
  return { success: false, error: `Shopify error ${statusCode}`, retryable: true, statusCode };
}

/** DELETE a product from Shopify. 404 is treated as success (idempotent). */
export async function deleteShopifyProduct(
  config: ShopifyCrosslistConfig,
  shopDomain: string,
  accessToken: string,
  externalId: string,
): Promise<ShopifyDeleteResult> {
  const url = `https://${shopDomain}/admin/api/${config.apiVersion}/products/${externalId}.json`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
  } catch (err) {
    return { success: false, error: String(err), retryable: true, statusCode: 0 };
  }

  const statusCode = response.status;
  if (response.ok || statusCode === 404) return { success: true, retryable: false, statusCode };
  if (statusCode === 401) return { success: false, error: 'Unauthorized', retryable: false, statusCode };
  if (statusCode === 429) return { success: false, error: 'Rate limited', retryable: true, statusCode };
  return { success: false, error: `Shopify error ${statusCode}`, retryable: true, statusCode };
}

/** GET a single product from Shopify to verify its current state. */
export async function fetchShopifyProductForVerify(
  config: ShopifyCrosslistConfig,
  shopDomain: string,
  accessToken: string,
  externalId: string,
): Promise<ShopifyVerifyResult> {
  const notFound: ShopifyVerifyResult = { exists: false, status: 'REMOVED', priceCents: null, quantity: null, lastModifiedAt: null };
  const url = `https://${shopDomain}/admin/api/${config.apiVersion}/products/${externalId}.json`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } });
  } catch {
    return notFound;
  }

  if (response.status === 404 || !response.ok) return notFound;

  const body = await response.json() as { product: unknown };
  const parsed = ShopifyProductSchema.safeParse(body.product);
  if (!parsed.success) return notFound;

  const product = parsed.data;
  const mappedStatus = mapShopifyStatus(product.status);
  // VerificationResult.status does not include DRAFT — map draft and sold to ENDED
  const verifyStatus: 'ACTIVE' | 'ENDED' | 'REMOVED' | 'UNKNOWN' =
    (mappedStatus === 'SOLD' || mappedStatus === 'DRAFT') ? 'ENDED' : mappedStatus;

  const firstVariant = product.variants[0];
  const priceCents = firstVariant ? parseShopifyPrice(firstVariant.price) : null;
  const quantity = Math.max(1, product.variants.reduce((sum, v) => sum + v.inventory_quantity, 0));

  let lastModifiedAt: Date | null = null;
  if (product.updated_at) {
    const d = new Date(product.updated_at);
    if (!isNaN(d.getTime())) lastModifiedAt = d;
  }

  return { exists: true, status: verifyStatus, priceCents, quantity, lastModifiedAt };
}
