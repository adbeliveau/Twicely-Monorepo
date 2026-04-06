/**
 * EtsyConnector — implements PlatformConnector for Etsy (Tier A, OAuth).
 * Source: F3 install prompt — Etsy; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new EtsyConnector()).
 *
 * Auth URL: https://www.etsy.com/oauth/connect
 * Token URL: https://api.etsy.com/v3/public/oauth/token
 * API base: https://openapi.etsy.com/v3
 *
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
import { withDecryptedTokens } from '../token-crypto';
import { normalizeEtsyListing, toExternalListing } from '@twicely/crosslister/connectors/etsy-normalizer';
import type { EtsyListingsResponse, EtsyTokenResponse, EtsyUserProfile } from '@twicely/crosslister/connectors/etsy-types';

const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const ETSY_API_BASE = 'https://openapi.etsy.com/v3';

const ETSY_SCOPES = ['listings_r', 'listings_w', 'profile_r'].join(' ');

const ETSY_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: true,
  hasStructuredCategories: true,
  canAutoRelist: true,
  canMakeOffers: true,
  canShare: false,
  maxImagesPerListing: 10,
  maxTitleLength: 140,
  maxDescriptionLength: 5000,
  supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
};

interface EtsyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadEtsyConfig(): Promise<EtsyConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.etsy.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.etsy.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.etsy.redirectUri') ??
        'https://twicely.co/api/crosslister/etsy/callback',
    ),
  };
}

export class EtsyConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'ETSY';
  readonly tier: ConnectorTier = 'A';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = ETSY_CAPABILITIES;

  /**
   * Build the Etsy OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadEtsyConfig();
    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: config.redirectUri,
      scope: ETSY_SCOPES,
      client_id: config.clientId,
      state,
      code_challenge_method: 'S256',
      code_challenge: state, // Simplified — production needs real PKCE
    });
    return `${ETSY_AUTH_URL}?${params.toString()}`;
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
        capabilities: ETSY_CAPABILITIES,
        error: 'Etsy connector only supports OAUTH auth method',
      };
    }

    const config = await loadEtsyConfig();

    try {
      const response = await fetch(ETSY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          redirect_uri: credentials.redirectUri ?? config.redirectUri,
          code: credentials.code,
          code_verifier: credentials.state ?? '',
        }).toString(),
      });

      const data: EtsyTokenResponse = await response.json() as EtsyTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[EtsyConnector.authenticate] Token exchange failed', {
          status: response.status,
          error: data.error,
          description: data.error_description,
        });
        return {
          success: false,
          externalAccountId: null,
          externalUsername: null,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: ETSY_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Fetch user profile to get shop_id and username
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const profileResponse = await fetch(`${ETSY_API_BASE}/application/users/me`, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            'x-api-key': config.clientId,
          },
        });
        if (profileResponse.ok) {
          const profile: EtsyUserProfile = await profileResponse.json() as EtsyUserProfile;
          externalAccountId = profile.shop_id ? String(profile.shop_id) : String(profile.user_id);
          externalUsername = profile.login_name;
        }
      } catch (profileErr) {
        logger.warn('[EtsyConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: ETSY_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[EtsyConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: ETSY_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    const acc = withDecryptedTokens(account);
    if (!acc.refreshToken) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: ETSY_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadEtsyConfig();

    try {
      const response = await fetch(ETSY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          refresh_token: acc.refreshToken,
        }).toString(),
      });

      const data: EtsyTokenResponse = await response.json() as EtsyTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: ETSY_CAPABILITIES,
          error: data.error_description ?? 'Token refresh failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      return {
        success: true,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? acc.refreshToken,
        sessionData: null,
        tokenExpiresAt,
        capabilities: ETSY_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[EtsyConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: ETSY_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[EtsyConnector.revokeAuth] Account revoked (Etsy has no revoke endpoint)');
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken || !account.externalAccountId) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadEtsyConfig();
    const shopId = account.externalAccountId;
    const limit = 25;
    const offset = cursor ? parseInt(cursor, 10) : 0;

    const url = `${ETSY_API_BASE}/application/shops/${encodeURIComponent(shopId)}/listings?state=active&limit=${limit}&offset=${offset}&includes[]=images&includes[]=prices`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          'x-api-key': config.clientId,
        },
      });

      if (response.status === 401) {
        logger.warn('[EtsyConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[EtsyConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: EtsyListingsResponse = await response.json() as EtsyListingsResponse;
      const items = data.results ?? [];
      const total = data.count ?? 0;

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeEtsyListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const nextOffset = offset + items.length;
      const hasMore = nextOffset < total;

      return {
        listings,
        cursor: hasMore ? String(nextOffset) : null,
        hasMore,
        totalEstimate: total,
      };
    } catch (err) {
      logger.error('[EtsyConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken) throw new Error('No access token');

    const config = await loadEtsyConfig();
    const url = `${ETSY_API_BASE}/application/listings/${encodeURIComponent(externalId)}?includes[]=images&includes[]=prices`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${acc.accessToken}`,
        'x-api-key': config.clientId,
      },
    });

    if (!response.ok) throw new Error(`Etsy API error: ${response.status}`);

    const item = await response.json() as import('./etsy-types').EtsyListing;
    return toExternalListing(normalizeEtsyListing(item));
  }

  /** Create a listing on Etsy via POST /v3/application/shops/{shopId}/listings. */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken || !account.externalAccountId) {
      return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    }
    const shopId = account.externalAccountId;
    try {
      const body = {
        title: listing.title,
        description: listing.descriptionHtml ?? listing.description,
        price: { amount: listing.priceCents, divisor: 100, currency_code: 'USD' },
        quantity: listing.quantity,
        who_made: 'i_did',
        is_supply: false,
        when_made: 'made_to_order',
        ...(listing.category.externalCategoryId ? { taxonomy_id: parseInt(listing.category.externalCategoryId, 10) } : {}),
        tags: Object.keys(listing.itemSpecifics).slice(0, 13),
      };
      const resp = await fetch(`${ETSY_API_BASE}/application/shops/${encodeURIComponent(shopId)}/listings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acc.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[EtsyConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Etsy API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { listing_id?: number; url?: string };
      const id = data.listing_id ? String(data.listing_id) : null;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: data.url ?? `https://www.etsy.com/listing/${id}`, retryable: false };
    } catch (err) {
      logger.error('[EtsyConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update an Etsy listing. */
  async updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken || !account.externalAccountId) return { success: false, error: 'No credentials', retryable: false };
    const shopId = account.externalAccountId;
    try {
      const body: Record<string, unknown> = {};
      if (changes.title) body['title'] = changes.title;
      if (changes.priceCents !== undefined) body['price'] = { amount: changes.priceCents, divisor: 100, currency_code: 'USD' };
      if (changes.description) body['description'] = changes.description;
      const resp = await fetch(`${ETSY_API_BASE}/application/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(externalId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${acc.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return { success: false, error: `Etsy API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Delete an Etsy listing. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken || !account.externalAccountId) return { success: false, error: 'No credentials', retryable: false };
    const shopId = account.externalAccountId;
    try {
      const resp = await fetch(`${ETSY_API_BASE}/application/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `Etsy API error: ${resp.status}`, retryable: resp.status >= 500 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async verifyListing(_account: CrosslisterAccount, _externalId: string): Promise<VerificationResult> {
    return { exists: false, status: 'UNKNOWN', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    const acc = withDecryptedTokens(account);
    if (!acc.accessToken) return { healthy: false, latencyMs: 0, error: 'No access token' };

    const config = await loadEtsyConfig();
    const url = `${ETSY_API_BASE}/application/openapi-ping`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          'x-api-key': config.clientId,
        },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Etsy API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new EtsyConnector());
