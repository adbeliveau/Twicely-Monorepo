/**
 * Shopify import helpers — fetchShopifyProducts, fetchSingleShopifyProduct.
 * Extracted from ShopifyConnector to keep connector.ts under the 300-line limit.
 * Source: H3.2 install prompt §2.4
 *
 * NOT a 'use server' file — plain TypeScript module.
 *
 * Pagination: Shopify uses RFC 8288 Link headers with page_info cursor.
 * CRITICAL: When page_info is present, ALL other query params (e.g. status=active)
 * are ignored by Shopify — the cursor encodes the original query.
 */

import type { ExternalListing, PaginatedListings } from '../types';
import { ShopifyProductSchema } from './shopify-schemas';
import { normalizeShopifyProduct, toExternalListing } from './shopify-normalizer';
import { logger } from '@twicely/logger';

interface ShopifyImportConfig {
  apiVersion: string;
}

const EMPTY_RESULT: PaginatedListings = {
  listings: [],
  cursor: null,
  hasMore: false,
  totalEstimate: null,
};

/**
 * Parse Shopify Link header to extract next page cursor.
 * Shopify uses RFC 8288 Link headers for cursor-based pagination.
 * Example: <https://{shop}/admin/api/.../products.json?page_info=abc123&limit=50>; rel="next"
 */
export function parseShopifyLinkHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    if (part.includes('rel="next"')) {
      const urlMatch = part.match(/<([^>]+)>/);
      if (urlMatch?.[1]) {
        try {
          const url = new URL(urlMatch[1]);
          return url.searchParams.get('page_info');
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Fetch a page of active products from a Shopify store.
 * Returns PaginatedListings with cursor extracted from the Link response header.
 *
 * First page: ?status=active&limit=50
 * Subsequent pages: ?page_info=CURSOR&limit=50  (status param omitted — cursor encodes it)
 */
export async function fetchShopifyProducts(
  config: ShopifyImportConfig,
  shopDomain: string,
  accessToken: string,
  cursor?: string,
): Promise<PaginatedListings> {
  // Build URL — first page includes status filter; subsequent pages use cursor only
  let url: string;
  if (cursor) {
    url = `https://${shopDomain}/admin/api/${config.apiVersion}/products.json?page_info=${cursor}&limit=50`;
  } else {
    url = `https://${shopDomain}/admin/api/${config.apiVersion}/products.json?status=active&limit=50`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
  } catch (err) {
    logger.error('[fetchShopifyProducts] Network error', { shopDomain, error: String(err) });
    return EMPTY_RESULT;
  }

  if (response.status === 401) {
    logger.warn('[fetchShopifyProducts] Unauthorized — access token may be revoked', { shopDomain });
    return EMPTY_RESULT;
  }

  if (!response.ok) {
    logger.error('[fetchShopifyProducts] Non-OK response', {
      shopDomain,
      status: response.status,
    });
    return EMPTY_RESULT;
  }

  const body = await response.json() as { products: unknown[] };
  const rawProducts = body.products ?? [];

  const listings: ExternalListing[] = [];
  for (const raw of rawProducts) {
    const parsed = ShopifyProductSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('[fetchShopifyProducts] Skipping invalid product', {
        shopDomain,
        errors: parsed.error.flatten(),
      });
      continue;
    }
    const normalized = normalizeShopifyProduct(parsed.data, shopDomain);
    // Filter to ACTIVE status only
    if (normalized.status !== 'ACTIVE') continue;
    listings.push(toExternalListing(normalized));
  }

  const nextCursor = parseShopifyLinkHeader(response.headers.get('link'));
  return {
    listings,
    cursor: nextCursor,
    hasMore: nextCursor !== null,
    totalEstimate: null,
  };
}

/**
 * Fetch a single product by ID from a Shopify store.
 * Throws on non-OK response or Zod validation failure.
 */
export async function fetchSingleShopifyProduct(
  config: ShopifyImportConfig,
  shopDomain: string,
  accessToken: string,
  externalId: string,
): Promise<ExternalListing> {
  const url = `https://${shopDomain}/admin/api/${config.apiVersion}/products/${externalId}.json`;

  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });

  if (!response.ok) {
    throw new Error(
      `fetchSingleShopifyProduct: Shopify returned ${response.status} for product ${externalId}`,
    );
  }

  const body = await response.json() as { product: unknown };
  const parsed = ShopifyProductSchema.safeParse(body.product);
  if (!parsed.success) {
    throw new Error(
      `fetchSingleShopifyProduct: Invalid product schema for ${externalId}: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  return toExternalListing(normalizeShopifyProduct(parsed.data, shopDomain));
}
