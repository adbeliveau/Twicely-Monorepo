/**
 * FbMarketplaceConnector — implements PlatformConnector for Facebook Marketplace (Tier B, OAuth).
 * Source: F3 install prompt — FB_MARKETPLACE; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new FbMarketplaceConnector()).
 *
 * Auth URL: https://www.facebook.com/v18.0/dialog/oauth
 * Token URL: https://graph.facebook.com/v18.0/oauth/access_token
 * API base: https://graph.facebook.com/v18.0
 *
 * TODO: Token encryption must be added before production.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
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
import { normalizeFbMarketplaceListing, toExternalListing } from './fb-marketplace-normalizer';
import type { FbCommerceListingsResponse, FbOAuthTokenResponse, FbUserProfile } from './fb-marketplace-types';

const FB_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FB_API_BASE = 'https://graph.facebook.com/v18.0';

const FB_SCOPES = ['commerce_account_manage_orders', 'catalog_management'].join(',');

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

interface FbMarketplaceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadFbMarketplaceConfig(): Promise<FbMarketplaceConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.fbMarketplace.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.fbMarketplace.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.fbMarketplace.redirectUri') ??
        'https://twicely.co/api/crosslister/fb-marketplace/callback',
    ),
  };
}

export class FbMarketplaceConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'FB_MARKETPLACE';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = FB_MARKETPLACE_CAPABILITIES;

  /**
   * Build the Facebook OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadFbMarketplaceConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: FB_SCOPES,
      state,
    });
    return `${FB_AUTH_URL}?${params.toString()}`;
  }

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    if (credentials.method !== 'OAUTH') {
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: FB_MARKETPLACE_CAPABILITIES,
        error: 'Facebook Marketplace connector only supports OAUTH auth method',
      };
    }

    const config = await loadFbMarketplaceConfig();

    try {
      const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: credentials.redirectUri ?? config.redirectUri,
        code: credentials.code,
      });

      const response = await fetch(`${FB_TOKEN_URL}?${params.toString()}`, {
        method: 'GET',
      });

      const data: FbOAuthTokenResponse = await response.json() as FbOAuthTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[FbMarketplaceConnector.authenticate] Token exchange failed', {
          status: response.status,
          error: data.error,
        });
        return {
          success: false,
          externalAccountId: null,
          externalUsername: null,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: FB_MARKETPLACE_CAPABILITIES,
          error: data.error?.message ?? 'OAuth token exchange failed',
        };
      }

      // Facebook long-lived tokens don't always have expires_in
      const tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      // Fetch user profile to get account identity
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const profileResponse = await fetch(`${FB_API_BASE}/me?fields=id,name`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResponse.ok) {
          const profile: FbUserProfile = await profileResponse.json() as FbUserProfile;
          externalAccountId = profile.id;
          externalUsername = profile.name;
        }
      } catch (profileErr) {
        logger.warn('[FbMarketplaceConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: null, // Facebook uses long-lived tokens, not refresh tokens
        sessionData: null,
        tokenExpiresAt,
        capabilities: FB_MARKETPLACE_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[FbMarketplaceConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: FB_MARKETPLACE_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    // Facebook uses long-lived tokens; re-auth required when expired
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities: FB_MARKETPLACE_CAPABILITIES,
      error: 'Facebook tokens cannot be refreshed. Please reconnect.',
    };
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[FbMarketplaceConnector.revokeAuth] Account revoked (no revoke endpoint used)');
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
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(pageId)}/commerce_listings?access_token=${account.accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(externalId)}?access_token=${account.accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const resp = await fetch(`${FB_API_BASE}/${encodeURIComponent(externalId)}?access_token=${account.accessToken}`, {
        method: 'DELETE',
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
