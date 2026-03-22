/**
 * GrailedConnector — implements PlatformConnector for Grailed (Tier B, OAuth).
 * Source: F3 install prompt — GRAILED; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new GrailedConnector()).
 *
 * Auth URL: https://www.grailed.com/oauth/authorize
 * Token URL: https://www.grailed.com/oauth/token
 * API base: https://www.grailed.com/api
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
import { normalizeGrailedListing, toExternalListing } from '@twicely/crosslister/connectors/grailed-normalizer';
import type { GrailedListingsResponse, GrailedTokenResponse, GrailedUserProfile } from '@twicely/crosslister/connectors/grailed-types';

const GRAILED_AUTH_URL = 'https://www.grailed.com/oauth/authorize';
const GRAILED_TOKEN_URL = 'https://www.grailed.com/oauth/token';
const GRAILED_API_BASE = 'https://www.grailed.com/api';

const GRAILED_CAPABILITIES: ConnectorCapabilities = {
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

interface GrailedConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadGrailedConfig(): Promise<GrailedConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.grailed.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.grailed.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.grailed.redirectUri') ??
        'https://twicely.co/api/crosslister/grailed/callback',
    ),
  };
}

export class GrailedConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'GRAILED';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = GRAILED_CAPABILITIES;

  /**
   * Build the Grailed OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadGrailedConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `${GRAILED_AUTH_URL}?${params.toString()}`;
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
        capabilities: GRAILED_CAPABILITIES,
        error: 'Grailed connector only supports OAUTH auth method',
      };
    }

    const config = await loadGrailedConfig();

    try {
      const response = await fetch(GRAILED_TOKEN_URL, {
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

      const data: GrailedTokenResponse = await response.json() as GrailedTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[GrailedConnector.authenticate] Token exchange failed', {
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
          capabilities: GRAILED_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Fetch user profile
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const profileResponse = await fetch(`${GRAILED_API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResponse.ok) {
          const profile: GrailedUserProfile = await profileResponse.json() as GrailedUserProfile;
          externalAccountId = String(profile.id);
          externalUsername = profile.username;
        }
      } catch (profileErr) {
        logger.warn('[GrailedConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: GRAILED_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[GrailedConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: GRAILED_CAPABILITIES,
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
        capabilities: GRAILED_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadGrailedConfig();

    try {
      const response = await fetch(GRAILED_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: account.refreshToken,
        }).toString(),
      });

      const data: GrailedTokenResponse = await response.json() as GrailedTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: GRAILED_CAPABILITIES,
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
        capabilities: GRAILED_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[GrailedConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: GRAILED_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[GrailedConnector.revokeAuth] Account revoked (no revoke endpoint available)');
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const perPage = 50;
    const page = cursor ? parseInt(cursor, 10) : 1;
    const url = `${GRAILED_API_BASE}/listings/mine?page=${page}&per_page=${perPage}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (response.status === 401) {
        logger.warn('[GrailedConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[GrailedConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: GrailedListingsResponse = await response.json() as GrailedListingsResponse;
      const items = data.listings ?? [];
      const total = data.total_count ?? 0;

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeGrailedListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const fetched = (page - 1) * perPage + items.length;
      const hasMore = fetched < total;
      const nextPage = hasMore ? page + 1 : null;

      return {
        listings,
        cursor: nextPage !== null ? String(nextPage) : null,
        hasMore,
        totalEstimate: total,
      };
    } catch (err) {
      logger.error('[GrailedConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    if (!account.accessToken) throw new Error('No access token');

    const response = await fetch(`${GRAILED_API_BASE}/listings/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) throw new Error(`Grailed API error: ${response.status}`);

    const item = await response.json() as import('./grailed-types').GrailedListing;
    return toExternalListing(normalizeGrailedListing(item));
  }

  /** Create a listing on Grailed via POST /api/listings. */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    if (!account.accessToken) return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    try {
      const body = {
        listing: {
          title: listing.title,
          description: listing.description,
          price_cents: listing.priceCents,
          size: listing.itemSpecifics['size'] ?? 'OS',
          condition: listing.condition ? (listing.condition.includes('NEW') ? 'is_new' : 'gently_used') : 'gently_used',
          category: listing.category.externalCategoryName || undefined,
          designer: listing.brand ?? undefined,
          photos: listing.images.map((i) => ({ url: i.url })),
        },
      };
      const resp = await fetch(`${GRAILED_API_BASE}/listings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[GrailedConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Grailed API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { listing?: { id?: number; slug?: string } };
      const id = data.listing?.id ? String(data.listing.id) : null;
      const slug = data.listing?.slug;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: slug ? `https://www.grailed.com/listings/${id}-${slug}` : `https://www.grailed.com/listings/${id}`, retryable: false };
    } catch (err) {
      logger.error('[GrailedConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update a Grailed listing via PUT /api/listings/{id}. */
  async updateListing(account: CrosslisterAccount, externalId: string, changes: Partial<TransformedListing>): Promise<UpdateResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const listingBody: Record<string, unknown> = {};
      if (changes.title) listingBody['title'] = changes.title;
      if (changes.priceCents !== undefined) listingBody['price_cents'] = changes.priceCents;
      if (changes.description) listingBody['description'] = changes.description;
      const resp = await fetch(`${GRAILED_API_BASE}/listings/${encodeURIComponent(externalId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing: listingBody }),
      });
      if (!resp.ok) return { success: false, error: `Grailed API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Set Grailed listing status to 'removed'. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    try {
      const resp = await fetch(`${GRAILED_API_BASE}/listings/${encodeURIComponent(externalId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing: { status: 'removed' } }),
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `Grailed API error: ${resp.status}`, retryable: resp.status >= 500 };
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
      const response = await fetch(`${GRAILED_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Grailed API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new GrailedConnector());
