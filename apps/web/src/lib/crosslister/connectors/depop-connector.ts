/**
 * DepopConnector — implements PlatformConnector for Depop (Tier B, OAuth).
 * Source: F3 install prompt — DEPOP; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new DepopConnector()).
 *
 * Auth helpers extracted to depop-auth.ts.
 * Normalizer functions in @twicely/crosslister depop-normalizer.ts.
 */

import { logger } from '@twicely/logger';
import type { PlatformConnector } from '../connector-interface';
import type { CrosslisterAccount } from '../db-types';
import type {
  ExternalChannel,
  ConnectorTier,
  ConnectorCapabilities,
  AuthInput,
  AuthResult,
  PaginatedListings,
  ExternalListing,
  TransformedListing,
  PublishResult,
  UpdateResult,
  DelistResult,
  VerificationResult,
  HealthResult,
} from '../types';
import { registerConnector } from '../connector-registry';
import { normalizeDepopListing, toExternalListing } from '@twicely/crosslister/connectors/depop-normalizer';
import type { DepopProductsResponse } from '@twicely/crosslister/connectors/depop-types';
import {
  DEPOP_API_BASE,
  depopBuildAuthUrl,
  depopAuthenticate,
  depopRefreshAuth,
  depopRevokeAuth,
} from './depop-auth';

const DEPOP_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: false,
  hasStructuredCategories: true,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 4,
  maxTitleLength: 80,
  maxDescriptionLength: 1000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

export class DepopConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'DEPOP';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = DEPOP_CAPABILITIES;

  async buildAuthUrl(state: string): Promise<string> {
    return depopBuildAuthUrl(state);
  }

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    return depopAuthenticate(credentials, DEPOP_CAPABILITIES);
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    return depopRefreshAuth(account, DEPOP_CAPABILITIES);
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    depopRevokeAuth();
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const url = cursor
      ? `${DEPOP_API_BASE}/products?status=active&after=${encodeURIComponent(cursor)}&limit=50`
      : `${DEPOP_API_BASE}/products?status=active&limit=50`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (response.status === 401) {
        logger.warn('[DepopConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[DepopConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: DepopProductsResponse = await response.json() as DepopProductsResponse;
      const items = data.objects ?? [];

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeDepopListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const hasMore = !(data.meta?.end ?? true);
      const nextCursor = data.meta?.next ?? null;

      return { listings, cursor: hasMore ? nextCursor : null, hasMore, totalEstimate: null };
    } catch (err) {
      logger.error('[DepopConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    if (!account.accessToken) throw new Error('No access token');

    const response = await fetch(`${DEPOP_API_BASE}/products/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) throw new Error(`Depop API error: ${response.status}`);

    const item = await response.json() as import('./depop-types').DepopProduct;
    return toExternalListing(normalizeDepopListing(item));
  }

  /** Create a listing on Depop via POST /api/v2/products. Max 4 images. */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    if (!account.accessToken) return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    try {
      const body = {
        description: listing.description,
        price: { intValue: listing.priceCents, scaledValue: (listing.priceCents / 100).toFixed(2), currency: 'USD' },
        quantity: listing.quantity,
        condition: listing.condition ? (listing.condition.includes('NEW') ? 'new_with_tags' : 'used_good') : 'used_good',
        images: listing.images.slice(0, 4).map((i) => ({ src: i.url })),
        brand: listing.brand ?? 'Unbranded',
        categoryId: listing.category.externalCategoryId || undefined,
      };
      const resp = await fetch(`${DEPOP_API_BASE}/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[DepopConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Depop API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { product?: { id?: number; slug?: string } };
      const id = data.product?.id ? String(data.product.id) : null;
      const slug = data.product?.slug;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No product ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: slug ? `https://www.depop.com/products/${slug}/` : `https://www.depop.com/`, retryable: false };
    } catch (err) {
      logger.error('[DepopConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update a Depop listing via PATCH /api/v2/products/{id}. */
  async updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const body: Record<string, unknown> = {};
      if (changes.priceCents !== undefined) body['price'] = { intValue: changes.priceCents, currency: 'USD' };
      if (changes.description) body['description'] = changes.description;
      const resp = await fetch(`${DEPOP_API_BASE}/products/${encodeURIComponent(externalId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return { success: false, error: `Depop API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Delete a Depop product. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const resp = await fetch(`${DEPOP_API_BASE}/products/${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `Depop API error: ${resp.status}`, retryable: resp.status >= 500 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async verifyListing(_account: CrosslisterAccount, _externalId: string): Promise<VerificationResult> {
    return { exists: false, status: 'UNKNOWN', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    if (!account.accessToken) return { healthy: false, latencyMs: 0, error: 'No access token' };

    const start = Date.now();
    try {
      const response = await fetch(`${DEPOP_API_BASE}/auth/users/me`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Depop API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new DepopConnector());
