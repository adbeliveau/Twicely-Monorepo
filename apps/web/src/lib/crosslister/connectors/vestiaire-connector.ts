/**
 * VestiaireConnector — implements PlatformConnector for Vestiaire Collective (Tier C, session-based).
 * Source: H4.2 install prompt — VESTIAIRE; Lister Canonical Section 9.4
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new VestiaireConnector()).
 *
 * Vestiaire Collective has no public API. Uses internal API at https://www.vestiairecollective.com/api.
 * Auth: extension captures session cookie → stored in sessionData.sessionToken.
 *
 */

import { db } from '@twicely/db';
import { withDecryptedTokens } from '../token-crypto';
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
import { tierCDelay } from '../services/platform-fees';
import { normalizeVestiaireListing, toExternalListing } from '@twicely/crosslister/connectors/vestiaire-normalizer';
import type { VestiaireListingsResponse, VestiaireSessionData } from '@twicely/crosslister/connectors/vestiaire-types';

const VESTIAIRE_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: false,    // Tier C — no update via API
  canDelist: true,
  hasWebhooks: false,  // No public API, no webhooks
  hasStructuredCategories: false,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 2000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

interface VestiaireConfig {
  apiBase: string;
  userAgent: string;
}

async function loadVestiaireConfig(): Promise<VestiaireConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    apiBase: String(
      settingsMap.get('crosslister.vestiaire.apiBase') ?? 'https://www.vestiairecollective.com/api',
    ),
    userAgent: String(
      settingsMap.get('crosslister.vestiaire.userAgent') ??
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    ),
  };
}

function extractSessionData(account: CrosslisterAccount): VestiaireSessionData | null {
  if (!account.sessionData) return null;
  const sd = account.sessionData as Record<string, unknown>;
  if (typeof sd['sessionToken'] !== 'string' || !sd['sessionToken']) {
    return null;
  }
  return {
    sessionToken: sd['sessionToken'],
    userId: typeof sd['userId'] === 'string' ? sd['userId'] : '',
    email: typeof sd['email'] === 'string' ? sd['email'] : '',
    detectedAt: typeof sd['detectedAt'] === 'number' ? sd['detectedAt'] : undefined,
  };
}

/** Internal auth response shape from Vestiaire POST /sessions */
interface VestiaireAuthApiResponse {
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  session_token?: string;
  error?: string;
  message?: string;
}

export class VestiaireConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'VESTIAIRE';
  readonly tier: ConnectorTier = 'C';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = VESTIAIRE_CAPABILITIES;

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    if (credentials.method !== 'SESSION') {
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
        error: 'Vestiaire Collective connector only supports SESSION auth method',
      };
    }

    const config = await loadVestiaireConfig();

    try {
      const response = await fetch(`${config.apiBase}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
        },
        body: JSON.stringify({
          email: credentials.username,
          password: credentials.password,
        }),
      });

      const data = await response.json() as VestiaireAuthApiResponse;

      if (!response.ok || !data.session_token || !data.user) {
        logger.error('[VestiaireConnector.authenticate] Login failed', {
          status: response.status,
          error: data.error ?? data.message,
        });
        return {
          success: false,
          externalAccountId: null,
          externalUsername: null,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: VESTIAIRE_CAPABILITIES,
          error: data.error ?? data.message ?? 'Invalid credentials',
        };
      }

      const sessionData: VestiaireSessionData = {
        sessionToken: data.session_token,
        userId: data.user.id,
        email: data.user.email,
        detectedAt: Date.now(),
      };

      return {
        success: true,
        externalAccountId: data.user.id,
        externalUsername: data.user.username ?? data.user.email,
        accessToken: null,
        refreshToken: null,
        sessionData,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[VestiaireConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    }

    const config = await loadVestiaireConfig();

    try {
      const response = await fetch(`${config.apiBase}/items?per_page=1`, {
        headers: {
          Cookie: `_vc_session=${sd.sessionToken}`,
          'User-Agent': config.userAgent,
        },
      });

      if (response.ok) {
        return {
          success: true,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: acc.sessionData as Record<string, unknown> | null,
          tokenExpiresAt: null,
          capabilities: VESTIAIRE_CAPABILITIES,
        };
      }

      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    } catch (err) {
      logger.error('[VestiaireConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: VESTIAIRE_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    }
  }

  async revokeAuth(account: CrosslisterAccount): Promise<void> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) return;

    const config = await loadVestiaireConfig();
    try {
      await fetch(`${config.apiBase}/sessions`, {
        method: 'DELETE',
        headers: {
          Cookie: `_vc_session=${sd.sessionToken}`,
          'User-Agent': config.userAgent,
        },
      });
    } catch (err) {
      logger.warn('[VestiaireConnector.revokeAuth] Logout failed (best effort)', {
        error: String(err),
      });
    }
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadVestiaireConfig();
    const perPage = 50;
    const page = cursor ? parseInt(cursor, 10) : 1;
    const url = `${config.apiBase}/items?page=${page}&per_page=${perPage}`;

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: `_vc_session=${sd.sessionToken}`,
          'User-Agent': config.userAgent,
        },
      });

      if (response.status === 401) {
        logger.warn('[VestiaireConnector.fetchListings] 401 — session expired', {
          accountId: account.id,
        });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[VestiaireConnector.fetchListings] API error', {
          status: response.status,
          accountId: account.id,
        });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data = await response.json() as VestiaireListingsResponse;
      const items = data.items ?? [];

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeVestiaireListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      const hasMore = data.has_more ?? false;
      const nextPage = hasMore ? page + 1 : null;

      return {
        listings,
        cursor: nextPage !== null ? String(nextPage) : null,
        hasMore,
        totalEstimate: data.total ?? null,
      };
    } catch (err) {
      logger.error('[VestiaireConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) throw new Error('No session data');

    const config = await loadVestiaireConfig();
    const response = await fetch(
      `${config.apiBase}/items/${encodeURIComponent(externalId)}`,
      {
        headers: {
          Cookie: `_vc_session=${sd.sessionToken}`,
          'User-Agent': config.userAgent,
        },
      },
    );

    if (!response.ok) throw new Error(`Vestiaire API error: ${response.status}`);

    const item = await response.json() as import('./vestiaire-types').VestiaireListing;
    return toExternalListing(normalizeVestiaireListing(item));
  }

  /**
   * Create a listing on Vestiaire Collective via session API.
   * Adds a 2-8 second human-like delay before the API call (Tier C safeguard).
   */
  async createListing(
    account: CrosslisterAccount,
    listing: TransformedListing,
  ): Promise<PublishResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) {
      return {
        success: false,
        externalId: null,
        externalUrl: null,
        error: 'No credentials',
        retryable: false,
      };
    }
    const config = await loadVestiaireConfig();
    await tierCDelay();
    try {
      const body = {
        title: listing.title,
        description: listing.description,
        price_cents: listing.priceCents,
        brand: listing.brand ?? 'Unknown',
        condition: listing.condition ?? 'good',
        images: listing.images.map((i) => ({ url: i.url })),
        category: listing.category.externalCategoryName ?? undefined,
      };
      const resp = await fetch(`${config.apiBase}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          Cookie: `_vc_session=${sd.sessionToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[VestiaireConnector] createListing failed', {
          status: resp.status,
          body: text.slice(0, 500),
        });
        return {
          success: false,
          externalId: null,
          externalUrl: null,
          error: `Vestiaire API error: ${resp.status}`,
          retryable: resp.status >= 500 || resp.status === 429,
        };
      }
      const data = await resp.json() as { item?: { id?: string } };
      const id = data.item?.id;
      if (!id) {
        return {
          success: false,
          externalId: null,
          externalUrl: null,
          error: 'No item ID returned',
          retryable: false,
        };
      }
      return {
        success: true,
        externalId: id,
        externalUrl: `https://www.vestiairecollective.com/products/p-${id}.html`,
        retryable: false,
      };
    } catch (err) {
      logger.error('[VestiaireConnector] createListing error', { error: String(err) });
      return {
        success: false,
        externalId: null,
        externalUrl: null,
        error: String(err),
        retryable: true,
      };
    }
  }

  /** Vestiaire Tier C does not support listing updates. */
  async updateListing(
    _account: CrosslisterAccount,
    _externalId: string,
    _changes: Partial<TransformedListing>,
  ): Promise<UpdateResult> {
    return {
      success: false,
      error: 'Vestiaire Collective does not support listing updates via API',
      retryable: false,
    };
  }

  /** Withdraw a Vestiaire listing by setting status to withdrawn. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) {
      return { success: false, error: 'No credentials', retryable: false };
    }
    const config = await loadVestiaireConfig();
    await tierCDelay();
    try {
      const resp = await fetch(
        `${config.apiBase}/items/${encodeURIComponent(externalId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': config.userAgent,
            Cookie: `_vc_session=${sd.sessionToken}`,
          },
          body: JSON.stringify({ status: 'withdrawn' }),
        },
      );
      if (!resp.ok && resp.status !== 404) {
        return {
          success: false,
          error: `Vestiaire API error: ${resp.status}`,
          retryable: resp.status >= 500,
        };
      }
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async verifyListing(
    _account: CrosslisterAccount,
    _externalId: string,
  ): Promise<VerificationResult> {
    return {
      exists: false,
      status: 'UNKNOWN',
      priceCents: null,
      quantity: null,
      lastModifiedAt: null,
      diff: null,
    };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionToken) return { healthy: false, latencyMs: 0, error: 'No session data' };

    const config = await loadVestiaireConfig();
    const url = `${config.apiBase}/items?per_page=1`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: `_vc_session=${sd.sessionToken}`,
          'User-Agent': config.userAgent,
        },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return {
        healthy: false,
        latencyMs,
        error: `Vestiaire API returned ${response.status}`,
      };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new VestiaireConnector());
