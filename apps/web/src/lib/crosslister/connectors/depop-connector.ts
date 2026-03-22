/**
 * DepopConnector — implements PlatformConnector for Depop (Tier B, OAuth).
 * Source: F3 install prompt — DEPOP; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new DepopConnector()).
 *
 * Auth URL: https://www.depop.com/oauth/authorize
 * Token URL: https://www.depop.com/oauth/token
 * API base: https://api.depop.com/api/v2
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
import { normalizeDepopListing, toExternalListing } from '@twicely/crosslister/connectors/depop-normalizer';
import type { DepopProductsResponse, DepopTokenResponse, DepopUserProfile } from '@twicely/crosslister/connectors/depop-types';

const DEPOP_AUTH_URL = 'https://www.depop.com/oauth/authorize';
const DEPOP_TOKEN_URL = 'https://www.depop.com/oauth/token';
const DEPOP_API_BASE = 'https://api.depop.com/api/v2';

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

interface DepopConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadDepopConfig(): Promise<DepopConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.depop.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.depop.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.depop.redirectUri') ??
        'https://twicely.co/api/crosslister/depop/callback',
    ),
  };
}

export class DepopConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'DEPOP';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = DEPOP_CAPABILITIES;

  /**
   * Build the Depop OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadDepopConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `${DEPOP_AUTH_URL}?${params.toString()}`;
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
        capabilities: DEPOP_CAPABILITIES,
        error: 'Depop connector only supports OAUTH auth method',
      };
    }

    const config = await loadDepopConfig();

    try {
      const response = await fetch(DEPOP_TOKEN_URL, {
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

      const data: DepopTokenResponse = await response.json() as DepopTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[DepopConnector.authenticate] Token exchange failed', {
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
          capabilities: DEPOP_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Fetch user profile to get account id and username
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const profileResponse = await fetch(`${DEPOP_API_BASE}/auth/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResponse.ok) {
          const profile: DepopUserProfile = await profileResponse.json() as DepopUserProfile;
          externalAccountId = profile.id;
          externalUsername = profile.username;
        }
      } catch (profileErr) {
        logger.warn('[DepopConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: DEPOP_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[DepopConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: DEPOP_CAPABILITIES,
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
        capabilities: DEPOP_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadDepopConfig();

    try {
      const response = await fetch(DEPOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: account.refreshToken,
        }).toString(),
      });

      const data: DepopTokenResponse = await response.json() as DepopTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: DEPOP_CAPABILITIES,
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
        capabilities: DEPOP_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[DepopConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: DEPOP_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[DepopConnector.revokeAuth] Account revoked (no revoke endpoint available)');
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
