/**
 * TheRealRealConnector — implements PlatformConnector for The RealReal (Tier C, session-based).
 * Source: F3 install prompt — THEREALREAL; Lister Canonical Section 9.4
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new TheRealRealConnector()).
 *
 * The RealReal has no public API. Uses internal API at https://www.therealreal.com/api/v1.
 * Auth: username/password → session cookie stored in sessionData.
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
import { normalizeTrrListing, toExternalListing } from '@twicely/crosslister/connectors/therealreal-normalizer';
import type { TrrAuthResponse, TrrConsignmentsResponse, TrrSessionData } from '@twicely/crosslister/connectors/therealreal-types';

const TRR_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: false,
  canDelist: true,
  hasWebhooks: false,
  hasStructuredCategories: false,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 2000,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

interface TrrConfig {
  apiBase: string;
  userAgent: string;
}

async function loadTrrConfig(): Promise<TrrConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    apiBase: String(
      settingsMap.get('crosslister.therealreal.apiBase') ?? 'https://www.therealreal.com/api/v1',
    ),
    userAgent: String(
      settingsMap.get('crosslister.therealreal.userAgent') ??
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    ),
  };
}

function extractSessionData(account: CrosslisterAccount): TrrSessionData | null {
  if (!account.sessionData) return null;
  const sd = account.sessionData as Record<string, unknown>;
  if (
    typeof sd['sessionId'] !== 'string' ||
    typeof sd['csrfToken'] !== 'string' ||
    typeof sd['userId'] !== 'string' ||
    typeof sd['email'] !== 'string'
  ) {
    return null;
  }
  return {
    sessionId: sd['sessionId'],
    csrfToken: sd['csrfToken'],
    userId: sd['userId'],
    email: sd['email'],
  };
}

export class TheRealRealConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'THEREALREAL';
  readonly tier: ConnectorTier = 'C';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = TRR_CAPABILITIES;

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
        capabilities: TRR_CAPABILITIES,
        error: 'The RealReal connector only supports SESSION auth method',
      };
    }

    const config = await loadTrrConfig();

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

      const data: TrrAuthResponse = await response.json() as TrrAuthResponse;

      if (!response.ok || !data.session_id || !data.user) {
        logger.error('[TheRealRealConnector.authenticate] Login failed', {
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
          capabilities: TRR_CAPABILITIES,
          error: data.error ?? data.message ?? 'Invalid credentials',
        };
      }

      const sessionData: TrrSessionData = {
        sessionId: data.session_id,
        csrfToken: data.csrf_token ?? '',
        userId: data.user.id,
        email: data.user.email,
      };

      const externalUsername = `${data.user.first_name} ${data.user.last_name}`.trim();

      return {
        success: true,
        externalAccountId: data.user.id,
        externalUsername: externalUsername || data.user.email,
        accessToken: null,
        refreshToken: null,
        sessionData,
        tokenExpiresAt: null,
        capabilities: TRR_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[TheRealRealConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: TRR_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: TRR_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    }

    const config = await loadTrrConfig();

    try {
      // Test session validity by fetching 1 consignment
      const response = await fetch(`${config.apiBase}/consignments?per_page=1`, {
        headers: {
          Cookie: `session_id=${sd.sessionId}`,
          'X-CSRF-Token': sd.csrfToken,
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
          capabilities: TRR_CAPABILITIES,
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
        capabilities: TRR_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    } catch (err) {
      logger.error('[TheRealRealConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: TRR_CAPABILITIES,
        error: 'Session expired. Please reconnect.',
      };
    }
  }

  async revokeAuth(account: CrosslisterAccount): Promise<void> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) return;

    const config = await loadTrrConfig();
    try {
      await fetch(`${config.apiBase}/sessions`, {
        method: 'DELETE',
        headers: {
          Cookie: `session_id=${sd.sessionId}`,
          'X-CSRF-Token': sd.csrfToken,
          'User-Agent': config.userAgent,
        },
      });
    } catch (err) {
      logger.warn('[TheRealRealConnector.revokeAuth] Logout failed (best effort)', { error: String(err) });
    }
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadTrrConfig();
    const perPage = 50;
    const page = cursor ? parseInt(cursor, 10) : 1;
    const url = `${config.apiBase}/consignments?page=${page}&per_page=${perPage}`;

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: `session_id=${sd.sessionId}`,
          'X-CSRF-Token': sd.csrfToken,
          'User-Agent': config.userAgent,
        },
      });

      if (response.status === 401) {
        logger.warn('[TheRealRealConnector.fetchListings] 401 — session expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[TheRealRealConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: TrrConsignmentsResponse = await response.json() as TrrConsignmentsResponse;
      const items = data.consignments ?? [];

      const listings: ExternalListing[] = items
        .map((item) => toExternalListing(normalizeTrrListing(item)))
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
      logger.error('[TheRealRealConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) throw new Error('No session data');

    const config = await loadTrrConfig();
    const response = await fetch(`${config.apiBase}/consignments/${encodeURIComponent(externalId)}`, {
      headers: {
        Cookie: `session_id=${sd.sessionId}`,
        'X-CSRF-Token': sd.csrfToken,
        'User-Agent': config.userAgent,
      },
    });

    if (!response.ok) throw new Error(`The RealReal API error: ${response.status}`);

    const item = await response.json() as import('./therealreal-types').TrrConsignment;
    return toExternalListing(normalizeTrrListing(item));
  }

  /**
   * Create a consignment on TheRealReal via session API.
   * Adds a 2-8 second human-like delay before the API call.
   */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    const config = await loadTrrConfig();
    await tierCDelay();
    try {
      const body = {
        title: listing.title,
        description: listing.description,
        price_cents: listing.priceCents,
        brand: listing.brand ?? 'Unknown',
        condition: listing.condition || 'good',
        images: listing.images.map((i) => ({ url: i.url })),
        category: listing.category.externalCategoryName || undefined,
      };
      const resp = await fetch(`${config.apiBase}/consignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          'X-Session-Id': sd.sessionId,
          'X-CSRF-Token': sd.csrfToken,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[TrrConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `TheRealReal API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { consignment?: { id?: string } };
      const id = data.consignment?.id;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No consignment ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: `https://www.therealreal.com/products/${id}`, retryable: false };
    } catch (err) {
      logger.error('[TrrConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** TRR Tier C does not support update. */
  async updateListing(_account: CrosslisterAccount, _externalId: string, _changes: Partial<TransformedListing>): Promise<UpdateResult> {
    return { success: false, error: 'TheRealReal does not support listing updates via API', retryable: false };
  }

  /** Withdraw a TRR consignment by setting status to withdrawn. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    const acc = withDecryptedTokens(account);
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) return { success: false, error: 'No credentials', retryable: false };
    const config = await loadTrrConfig();
    await tierCDelay();
    try {
      const resp = await fetch(`${config.apiBase}/consignments/${encodeURIComponent(externalId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          'X-Session-Id': sd.sessionId,
          'X-CSRF-Token': sd.csrfToken,
        },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (!resp.ok && resp.status !== 404) return { success: false, error: `TheRealReal API error: ${resp.status}`, retryable: resp.status >= 500 };
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
    const sd = extractSessionData(acc);
    if (!sd?.sessionId) return { healthy: false, latencyMs: 0, error: 'No session data' };

    const config = await loadTrrConfig();
    const url = `${config.apiBase}/consignments?per_page=1`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: `session_id=${sd.sessionId}`,
          'X-CSRF-Token': sd.csrfToken,
          'User-Agent': config.userAgent,
        },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `The RealReal API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new TheRealRealConnector());
