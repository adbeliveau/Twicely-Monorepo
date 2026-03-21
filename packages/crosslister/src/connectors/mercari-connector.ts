/**
 * MercariConnector — implements PlatformConnector for Mercari (Tier B, OAuth).
 * Source: F2 install prompt §2.2.3
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new MercariConnector()).
 *
 * TODO: Token encryption must be added before production.
 *       Tokens stored as plain text for F2.
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
import { normalizeMercariListing, toExternalListing } from './mercari-normalizer';
import type { MercariListingsResponse, MercariTokenResponse, MercariUserProfile } from './mercari-types';

const MERCARI_AUTH_URL = 'https://www.mercari.com/oauth/authorize';
const MERCARI_TOKEN_URL = 'https://api.mercari.com/oauth/token';
const MERCARI_API_BASE = 'https://api.mercari.com/v1';

const MERCARI_CAPABILITIES: ConnectorCapabilities = {
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
  maxDescriptionLength: 1000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

interface MercariConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadMercariConfig(): Promise<MercariConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.mercari.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.mercari.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.mercari.redirectUri') ??
        'https://twicely.co/api/crosslister/mercari/callback',
    ),
  };
}

export class MercariConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'MERCARI';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = MERCARI_CAPABILITIES;

  /**
   * Build the Mercari OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadMercariConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `${MERCARI_AUTH_URL}?${params.toString()}`;
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
        capabilities: MERCARI_CAPABILITIES,
        error: 'Mercari connector only supports OAUTH auth method',
      };
    }

    const config = await loadMercariConfig();

    try {
      const response = await fetch(MERCARI_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: credentials.code,
          redirect_uri: credentials.redirectUri ?? config.redirectUri,
        }).toString(),
      });

      const data: MercariTokenResponse = await response.json() as MercariTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[MercariConnector.authenticate] Token exchange failed', {
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
          capabilities: MERCARI_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Fetch user profile to get externalAccountId and externalUsername
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const profileResponse = await fetch(`${MERCARI_API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResponse.ok) {
          const profile: MercariUserProfile = await profileResponse.json() as MercariUserProfile;
          externalAccountId = profile.id;
          externalUsername = profile.name;
        }
      } catch (profileErr) {
        logger.warn('[MercariConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: MERCARI_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[MercariConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: MERCARI_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    if (!account.refreshToken) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: MERCARI_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadMercariConfig();

    try {
      const response = await fetch(MERCARI_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: account.refreshToken,
        }).toString(),
      });

      const data: MercariTokenResponse = await response.json() as MercariTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: MERCARI_CAPABILITIES,
          error: data.error_description ?? 'Token refresh failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      return {
        success: true,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? account.refreshToken,
        sessionData: null,
        tokenExpiresAt,
        capabilities: MERCARI_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[MercariConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: MERCARI_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[MercariConnector.revokeAuth] Account revoked (no revoke endpoint available)');
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const url = cursor
      ? `${MERCARI_API_BASE}/users/me/items?status=on_sale&page_token=${encodeURIComponent(cursor)}&page_size=50`
      : `${MERCARI_API_BASE}/users/me/items?status=on_sale&page_size=50`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (response.status === 401) {
        logger.warn('[MercariConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[MercariConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: MercariListingsResponse = await response.json() as MercariListingsResponse;
      const items = data.data ?? [];

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeMercariListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const hasMore = data.meta?.has_next ?? false;
      const nextCursor = data.meta?.next_page_token ?? null;

      return { listings, cursor: hasMore ? nextCursor : null, hasMore, totalEstimate: null };
    } catch (err) {
      logger.error('[MercariConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    if (!account.accessToken) throw new Error('No access token');

    const response = await fetch(`${MERCARI_API_BASE}/items/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) throw new Error(`Mercari API error: ${response.status}`);

    const item = await response.json() as import('./mercari-types').MercariItem;
    return toExternalListing(normalizeMercariListing(item));
  }

  /** Create a listing on Mercari via POST /v1/listings. */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    if (!account.accessToken) return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    try {
      const body = {
        name: listing.title,
        description: listing.description,
        price: listing.priceCents,
        status: 'on_sale',
        images: listing.images.map((i) => i.url),
        item_condition: listing.condition || 'good',
        shipping_payer: listing.shipping.type === 'FREE' ? 'seller' : 'buyer',
        shipping_fee_amount: listing.shipping.flatRateCents ?? 0,
      };
      const resp = await fetch(`${MERCARI_API_BASE}/listings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[MercariConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Mercari API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { id?: string };
      const id = data.id;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: `https://www.mercari.com/us/item/${id}/`, retryable: false };
    } catch (err) {
      logger.error('[MercariConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update a Mercari listing via PATCH /v1/listings/{id}. */
  async updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const body: Record<string, unknown> = {};
      if (changes.title) body['name'] = changes.title;
      if (changes.priceCents !== undefined) body['price'] = changes.priceCents;
      if (changes.description) body['description'] = changes.description;
      const resp = await fetch(`${MERCARI_API_BASE}/listings/${encodeURIComponent(externalId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return { success: false, error: `Mercari API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** End a Mercari listing by setting status to 'ended'. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const resp = await fetch(`${MERCARI_API_BASE}/listings/${encodeURIComponent(externalId)}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `Mercari API error: ${resp.status}`, retryable: resp.status >= 500 };
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
      const response = await fetch(`${MERCARI_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Mercari API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new MercariConnector());
