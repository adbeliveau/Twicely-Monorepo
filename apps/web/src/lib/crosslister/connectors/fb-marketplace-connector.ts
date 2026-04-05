/**
 * FbMarketplaceConnector — implements PlatformConnector for Facebook Marketplace (Tier B, OAuth).
 * Source: F3 install prompt — FB_MARKETPLACE; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new FbMarketplaceConnector()).
 *
 * Auth helpers extracted to fb-marketplace-auth.ts.
 * Normalizer functions in @twicely/crosslister fb-marketplace-normalizer.ts.
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
import { normalizeFbMarketplaceListing, toExternalListing } from '@twicely/crosslister/connectors/fb-marketplace-normalizer';
import type { FbCommerceListingsResponse } from '@twicely/crosslister/connectors/fb-marketplace-types';
import {
  FB_API_BASE,
  fbMarketplaceBuildAuthUrl,
  fbMarketplaceAuthenticate,
  fbMarketplaceRefreshAuth,
  fbMarketplaceRevokeAuth,
} from './fb-marketplace-auth';

const FB_MARKETPLACE_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: false,
  hasStructuredCategories: true,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 5000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

export class FbMarketplaceConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'FB_MARKETPLACE';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = FB_MARKETPLACE_CAPABILITIES;

  async buildAuthUrl(state: string): Promise<string> {
    return fbMarketplaceBuildAuthUrl(state);
  }

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    return fbMarketplaceAuthenticate(credentials, FB_MARKETPLACE_CAPABILITIES);
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    return fbMarketplaceRefreshAuth(account, FB_MARKETPLACE_CAPABILITIES);
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    fbMarketplaceRevokeAuth();
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const url = cursor
      ? `${FB_API_BASE}/me/commerce_listings?fields=id,name,description,price,currency,condition,availability,category,brand,images,product_item_id,created_time,retailer_id&after=${encodeURIComponent(cursor)}&limit=50`
      : `${FB_API_BASE}/me/commerce_listings?fields=id,name,description,price,currency,condition,availability,category,brand,images,product_item_id,created_time,retailer_id&limit=50`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (response.status === 401) {
        logger.warn('[FbMarketplaceConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[FbMarketplaceConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: FbCommerceListingsResponse = await response.json() as FbCommerceListingsResponse;
      const items = data.data ?? [];

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeFbMarketplaceListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const nextCursor = data.paging?.cursors?.after ?? null;
      const hasMore = !!data.paging?.next;

      return { listings, cursor: hasMore ? nextCursor : null, hasMore, totalEstimate: null };
    } catch (err) {
      logger.error('[FbMarketplaceConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    if (!account.accessToken) throw new Error('No access token');

    const url = `${FB_API_BASE}/${encodeURIComponent(externalId)}?fields=id,name,description,price,currency,condition,availability,category,brand,images,product_item_id,created_time,retailer_id`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) throw new Error(`Facebook API error: ${response.status}`);

    const item = await response.json() as import('./fb-marketplace-types').FbCommerceListing;
    return toExternalListing(normalizeFbMarketplaceListing(item));
  }

  /** Create a listing on Facebook Marketplace via Graph API v18.0. */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    if (!account.accessToken || !account.externalAccountId) {
      return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    }
    const pageId = account.externalAccountId;
    try {
      const body = {
        name: listing.title,
        description: listing.description,
        price: listing.priceCents,
        currency: 'USD',
        availability: 'IN_STOCK',
        condition: listing.condition ? (listing.condition.includes('NEW') ? 'NEW' : 'USED_GOOD') : 'USED_GOOD',
        image_urls: listing.images.map((i) => i.url),
        category: listing.category.externalCategoryName || undefined,
      };
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(pageId)}/commerce_listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${account.accessToken}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[FbMarketplaceConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Facebook API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { id?: string };
      const id = data.id;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: `https://www.facebook.com/marketplace/item/${id}/`, retryable: false };
    } catch (err) {
      logger.error('[FbMarketplaceConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update a Facebook Marketplace listing. */
  async updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const body: Record<string, unknown> = {};
      if (changes.title) body['name'] = changes.title;
      if (changes.priceCents !== undefined) body['price'] = changes.priceCents;
      if (changes.description) body['description'] = changes.description;
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(externalId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${account.accessToken}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return { success: false, error: `Facebook API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Delete a Facebook Marketplace listing. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${account.accessToken}` },
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `Facebook API error: ${resp.status}`, retryable: resp.status >= 500 };
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
      const response = await fetch(`${FB_API_BASE}/me?fields=id`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Facebook API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new FbMarketplaceConnector());
